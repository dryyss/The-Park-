import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";
import { roundEur } from "@/lib/wallet";
import { sendTransactionalEmail } from "@/lib/resend";

interface InvoiceLineItem {
  cardName: string;
  unitPrice: number;
  sellerName?: string;
}

async function generateInvoiceNumber(checkoutNumber: string, suffix: string): Promise<string> {
  const base = `FAC-${checkoutNumber}-${suffix}`;
  const exists = await prisma.marketplaceInvoice.findUnique({ where: { invoiceNumber: base }, select: { id: true } });
  if (!exists) return base;
  return `${base}-${Math.floor(Math.random() * 1000)}`;
}

function invoiceEmailHtml(input: {
  title: string;
  checkoutNumber: string;
  invoiceNumber: string;
  recipientName: string;
  lines: InvoiceLineItem[];
  total: number;
  role: "buyer" | "seller";
}): string {
  const rows = input.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #333">${l.cardName}${l.sellerName ? ` · ${l.sellerName}` : ""}</td><td style="padding:8px 0;border-bottom:1px solid #333;text-align:right">${formatPrice(l.unitPrice)}</td></tr>`,
    )
    .join("");

  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#FBF4F6;background:#1E2424;padding:24px;border-radius:12px">
    <p style="font-size:11px;letter-spacing:2px;color:#D6004F;text-transform:uppercase">The Park · Marketplace</p>
    <h1 style="font-size:20px;margin:12px 0">${input.title}</h1>
    <p style="font-size:13px;color:#aaa">Bonjour ${input.recipientName},</p>
    <p style="font-size:13px;color:#ccc">Commande <strong>${input.checkoutNumber}</strong> · Facture <strong>${input.invoiceNumber}</strong></p>
    <table style="width:100%;margin:20px 0;font-size:13px">${rows}</table>
    <p style="font-size:16px;font-weight:bold;text-align:right;color:#E8B23A">Total : ${formatPrice(input.total)}</p>
    ${
      input.role === "seller"
        ? "<p style=\"font-size:12px;color:#aaa;margin-top:16px\">Le montant net a été crédité sur ton solde vendeur (gains retirables).</p>"
        : "<p style=\"font-size:12px;color:#aaa;margin-top:16px\">Conserve cette facture pour ton historique d'achat.</p>"
    }
  </div>`;
}

/** Crée les factures acheteur + vendeurs et envoie les e-mails. */
export async function issueMarketplaceInvoices(input: {
  checkoutId: string;
  checkoutNumber: string;
  buyer: { id: string; email: string; displayName: string };
  lines: {
    saleId: string;
    sellerId: string;
    seller: { id: string; email: string; displayName: string };
    cardName: string;
    unitPrice: number;
  }[];
  paymentIntentId: string | null;
}): Promise<void> {
  const buyerLines: InvoiceLineItem[] = input.lines.map((l) => ({
    cardName: l.cardName,
    unitPrice: l.unitPrice,
    sellerName: l.seller.displayName,
  }));
  const buyerTotal = roundEur(buyerLines.reduce((s, l) => s + l.unitPrice, 0));

  const buyerInvoiceNumber = await generateInvoiceNumber(input.checkoutNumber, "ACH");
  await prisma.marketplaceInvoice.create({
    data: {
      checkoutId: input.checkoutId,
      invoiceNumber: buyerInvoiceNumber,
      recipient: "BUYER",
      userId: input.buyer.id,
      amount: buyerTotal,
      lineItems: buyerLines as unknown as Prisma.InputJsonValue,
      stripePaymentIntentId: input.paymentIntentId,
      emailedAt: new Date(),
    },
  });

  await sendTransactionalEmail({
    to: input.buyer.email,
    subject: `Facture marketplace ${buyerInvoiceNumber} — The Park`,
    html: invoiceEmailHtml({
      title: "Facture d'achat marketplace",
      checkoutNumber: input.checkoutNumber,
      invoiceNumber: buyerInvoiceNumber,
      recipientName: input.buyer.displayName,
      lines: buyerLines,
      total: buyerTotal,
      role: "buyer",
    }),
  });

  const bySeller = new Map<string, typeof input.lines>();
  for (const line of input.lines) {
    const group = bySeller.get(line.sellerId) ?? [];
    group.push(line);
    bySeller.set(line.sellerId, group);
  }

  let sellerIdx = 1;
  for (const [, sellerLines] of bySeller) {
    const seller = sellerLines[0]!.seller;
    const items: InvoiceLineItem[] = sellerLines.map((l) => ({ cardName: l.cardName, unitPrice: l.unitPrice }));
    const total = roundEur(items.reduce((s, l) => s + l.unitPrice, 0));
    const invoiceNumber = await generateInvoiceNumber(input.checkoutNumber, `V${sellerIdx}`);
    sellerIdx++;

    await prisma.marketplaceInvoice.create({
      data: {
        checkoutId: input.checkoutId,
        invoiceNumber,
        recipient: "SELLER",
        userId: seller.id,
        sellerId: seller.id,
        amount: total,
        lineItems: items as unknown as Prisma.InputJsonValue,
        stripePaymentIntentId: input.paymentIntentId,
        emailedAt: new Date(),
      },
    });

    await sendTransactionalEmail({
      to: seller.email,
      subject: `Vente marketplace ${invoiceNumber} — The Park`,
      html: invoiceEmailHtml({
        title: "Facture de vente marketplace",
        checkoutNumber: input.checkoutNumber,
        invoiceNumber,
        recipientName: seller.displayName,
        lines: items,
        total,
        role: "seller",
      }),
    });
  }
}
