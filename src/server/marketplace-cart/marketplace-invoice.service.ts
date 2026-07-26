import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { formatPrice } from "@/lib/format";
import { roundEur } from "@/lib/wallet";
import { sendTransactionalEmail } from "@/lib/resend";
import { buildMarketplaceInvoiceEmail } from "@/server/notification/transactional-emails";

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

/** Facture marketplace mise en forme aux couleurs de The Park (voir email-layout.ts). */
function invoiceEmail(input: {
  checkoutNumber: string;
  invoiceNumber: string;
  recipientName: string;
  lines: InvoiceLineItem[];
  total: number;
  role: "buyer" | "seller";
}) {
  return buildMarketplaceInvoiceEmail({
    role: input.role,
    invoiceNumber: input.invoiceNumber,
    checkoutNumber: input.checkoutNumber,
    recipientName: input.recipientName,
    lines: input.lines.map((l) => ({
      cardName: l.cardName,
      unitPrice: formatPrice(l.unitPrice),
      sellerName: l.sellerName ?? null,
    })),
    total: formatPrice(input.total),
  });
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
    ...invoiceEmail({
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
      ...invoiceEmail({
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
