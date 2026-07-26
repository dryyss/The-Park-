import "server-only";
import {
  appUrl,
  b,
  blockAmount,
  blockData,
  blockItems,
  blockPanel,
  blockSteps,
  esc,
  renderEmail,
} from "@/server/notification/email-layout";
import type { NotificationEmail } from "@/server/notification/email-templates";

/**
 * E-mails transactionnels hors notifications : compte, newsletter, commandes et
 * factures. Même charte que `buildNotificationEmail` (voir email-layout.ts).
 *
 * Ces fonctions sont pures (aucun accès base) : elles se prévisualisent telles
 * quelles dans /api/dev/emails.
 */

// ---------------------------------------------------------------------------
//  Compte
// ---------------------------------------------------------------------------

/** Bienvenue — envoyé à la création du compte. */
export function buildWelcomeEmail(input: { displayName: string; locale?: string }): NotificationEmail {
  const locale = input.locale ?? "fr";
  return {
    subject: "Bienvenue dans le garage — The Park",
    html: renderEmail({
      eyebrow: "Bienvenue",
      title: "Ton classeur t'attend",
      preheader: "Ouvre ta collection, complète la Saison 1 et rejoins la communauté.",
      recipientName: input.displayName,
      tone: "brand",
      locale,
      body: [
        "Ton compte The Park est actif. Ici, chaque carte est une voiture, chaque saison une série — et ta collection se pilote comme un garage.",
      ],
      blocks: [
        blockSteps([
          `Complète ton profil et choisis ton pseudo de collectionneur.`,
          `Ajoute tes premières cartes à ${b("ta collection")} pour suivre ta progression.`,
          `Repère les manquantes via ${b("la wishlist")} : tu seras alerté dès qu'une carte est mise en vente.`,
          `Échange, vends ou enchéris avec les autres membres en toute sécurité.`,
        ]),
        blockPanel(
          "Les échanges et ventes entre membres sont couverts par le mode sécurisé : caution bloquée, preuves vidéo, fonds libérés à la réception.",
          "success",
        ),
      ],
      cta: { label: "Ouvrir ma collection", url: appUrl("/collection", locale) },
      secondary: { label: "Découvrir la boutique officielle", url: appUrl("/boutique", locale) },
    }),
  };
}

// ---------------------------------------------------------------------------
//  Newsletter (double opt-in RGPD, multilingue)
// ---------------------------------------------------------------------------

interface NewsletterCopy {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  cta: string;
  note: string;
  prefsNote: string;
  welcomeSubject: string;
  welcomeTitle: string;
  welcomeIntro: string;
  welcomeCta: string;
  perks: string[];
}

const NEWSLETTER_COPY: Record<string, NewsletterCopy> = {
  fr: {
    subject: "Confirme ton inscription — The Park",
    eyebrow: "Newsletter",
    title: "Confirme ton adresse",
    intro:
      "Merci de ton intérêt pour The Park. Confirme ton adresse pour recevoir les drops, les nouveautés et les temps forts de la communauté.",
    cta: "Confirmer mon inscription",
    note: "Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail : aucune adresse ne sera enregistrée.",
    prefsNote: "Tu reçois cet e-mail parce qu'une inscription à la newsletter a été demandée avec cette adresse.",
    welcomeSubject: "Inscription confirmée — The Park",
    welcomeTitle: "C'est confirmé",
    welcomeIntro: "Te voilà dans la boucle. Tu seras prévenu en avant-première des sorties et des éditions limitées.",
    welcomeCta: "Découvrir la boutique",
    perks: [
      "Les dates de drop annoncées avant tout le monde",
      "Les cartes hors-série et éditions limitées",
      "Les temps forts de la communauté (tournois, classements)",
    ],
  },
  en: {
    subject: "Confirm your subscription — The Park",
    eyebrow: "Newsletter",
    title: "Confirm your email",
    intro:
      "Thanks for your interest in The Park. Confirm your address to receive drops, news and community highlights.",
    cta: "Confirm my subscription",
    note: "If you didn't request this, just ignore this email — no address will be stored.",
    prefsNote: "You received this email because a newsletter signup was requested with this address.",
    welcomeSubject: "Subscription confirmed — The Park",
    welcomeTitle: "You're in",
    welcomeIntro: "You'll now hear about releases and limited editions before anyone else.",
    welcomeCta: "Browse the shop",
    perks: [
      "Drop dates announced first",
      "Special and limited edition cards",
      "Community highlights (tournaments, leaderboards)",
    ],
  },
  ja: {
    subject: "登録の確認 — The Park",
    eyebrow: "ニュースレター",
    title: "メールアドレスの確認",
    intro:
      "The Park にご関心をお寄せいただきありがとうございます。ドロップ情報やお知らせを受け取るには、アドレスを確認してください。",
    cta: "登録を確認する",
    note: "心当たりがない場合は、このメールを無視してください。アドレスは保存されません。",
    prefsNote: "このアドレスでニュースレター登録がリクエストされたため、このメールが送信されました。",
    welcomeSubject: "登録が完了しました — The Park",
    welcomeTitle: "登録完了",
    welcomeIntro: "新作や限定版の情報を、いち早くお届けします。",
    welcomeCta: "ショップを見る",
    perks: ["ドロップ日程の先行案内", "特別版・限定版カード", "コミュニティの最新情報（大会・ランキング）"],
  },
};

function newsletterCopy(locale: string): NewsletterCopy {
  return NEWSLETTER_COPY[locale] ?? NEWSLETTER_COPY.fr!;
}

/** Double opt-in : lien de confirmation d'inscription. */
export function buildNewsletterConfirmEmail(input: { confirmUrl: string; locale?: string }): NotificationEmail {
  const locale = input.locale ?? "fr";
  const copy = newsletterCopy(locale);
  return {
    subject: copy.subject,
    html: renderEmail({
      eyebrow: copy.eyebrow,
      title: copy.title,
      preheader: copy.intro,
      tone: "brand",
      locale,
      body: [esc(copy.intro)],
      cta: { label: copy.cta, url: input.confirmUrl },
      footerNote: esc(copy.note),
      prefsNote: esc(copy.prefsNote),
    }),
  };
}

/** Confirmation enregistrée : e-mail de bienvenue newsletter. */
export function buildNewsletterWelcomeEmail(input: { locale?: string; unsubscribeUrl?: string }): NotificationEmail {
  const locale = input.locale ?? "fr";
  const copy = newsletterCopy(locale);
  return {
    subject: copy.welcomeSubject,
    html: renderEmail({
      eyebrow: copy.eyebrow,
      title: copy.welcomeTitle,
      preheader: copy.welcomeIntro,
      tone: "success",
      locale,
      body: [esc(copy.welcomeIntro)],
      blocks: [blockSteps(copy.perks.map((p) => esc(p)))],
      cta: { label: copy.welcomeCta, url: appUrl("/boutique", locale) },
      secondary: input.unsubscribeUrl ? { label: "Se désinscrire", url: input.unsubscribeUrl } : null,
      prefsNote: esc(copy.prefsNote),
    }),
  };
}

// ---------------------------------------------------------------------------
//  Boutique officielle
// ---------------------------------------------------------------------------

export interface ShopOrderEmailInput {
  orderNumber: string;
  customerName: string;
  items: { name: string; sku?: string | null; quantity: number; lineTotal: string }[];
  subtotal: string;
  shippingCost: string;
  total: string;
  shipping?: {
    name?: string | null;
    line1?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    method?: string | null;
  } | null;
  orderUrl: string;
  locale?: string;
}

/** Confirmation de commande boutique — envoyée à l'encaissement du paiement. */
export function buildShopOrderConfirmationEmail(input: ShopOrderEmailInput): NotificationEmail {
  const locale = input.locale ?? "fr";
  const address = input.shipping;
  const addressLines = [
    address?.name,
    address?.line1,
    [address?.zip, address?.city].filter(Boolean).join(" "),
    address?.country,
  ]
    .filter(Boolean)
    .map((l) => esc(l))
    .join("<br/>");

  return {
    subject: `Commande confirmée — n°${input.orderNumber}`,
    html: renderEmail({
      eyebrow: "Boutique",
      title: "Merci, ta commande est confirmée",
      preheader: `Commande n°${input.orderNumber} — ${input.total}`,
      recipientName: input.customerName,
      tone: "gold",
      locale,
      body: [
        `Ton paiement est encaissé et ta commande ${b(input.orderNumber)} part en préparation. Tu recevras un e-mail dès l'expédition, avec le numéro de suivi.`,
      ],
      blocks: [
        blockItems(
          input.items.map((it) => ({
            label: it.name,
            sub: [it.sku, it.quantity > 1 ? `×${it.quantity}` : null].filter(Boolean).join(" · ") || undefined,
            right: it.lineTotal,
          })),
          { label: "Total payé", value: input.total },
        ),
        blockData([
          { label: "Sous-total", value: esc(input.subtotal) },
          { label: "Livraison", value: esc(input.shippingCost) },
          { label: "Mode d'envoi", value: address?.method ? esc(address.method) : "" },
        ]),
        addressLines ? blockPanel(`<strong style="color:#f2efe9">Adresse de livraison</strong><br/>${addressLines}`) : "",
      ],
      cta: { label: "Suivre ma commande", url: input.orderUrl },
      footerNote:
        "Une erreur dans l'adresse ? Contacte le support dans l'heure : au-delà, la commande peut déjà être préparée.",
    }),
  };
}

// ---------------------------------------------------------------------------
//  Factures marketplace
// ---------------------------------------------------------------------------

export interface InvoiceEmailInput {
  role: "buyer" | "seller";
  invoiceNumber: string;
  checkoutNumber: string;
  recipientName: string;
  lines: { cardName: string; unitPrice: string; sellerName?: string | null }[];
  total: string;
  locale?: string;
}

/** Facture marketplace (acheteur ou vendeur) — document comptable, sans lien de préférences. */
export function buildMarketplaceInvoiceEmail(input: InvoiceEmailInput): NotificationEmail {
  const locale = input.locale ?? "fr";
  const isBuyer = input.role === "buyer";

  return {
    subject: isBuyer
      ? `Facture marketplace ${input.invoiceNumber} — The Park`
      : `Vente marketplace ${input.invoiceNumber} — The Park`,
    html: renderEmail({
      eyebrow: "Marketplace",
      title: isBuyer ? "Facture d'achat" : "Facture de vente",
      preheader: `${input.invoiceNumber} — ${input.total}`,
      recipientName: input.recipientName,
      tone: "gold",
      locale,
      showPrefsLink: false,
      body: [
        isBuyer
          ? "Voici la facture correspondant à ton achat sur le marketplace The Park."
          : "Voici la facture correspondant à ta vente sur le marketplace The Park.",
      ],
      blocks: [
        blockData([
          { label: "Facture", value: esc(input.invoiceNumber) },
          { label: "Commande", value: esc(input.checkoutNumber) },
        ]),
        blockItems(
          input.lines.map((l) => ({
            label: l.cardName,
            sub: l.sellerName ? `Vendu par ${l.sellerName}` : undefined,
            right: l.unitPrice,
          })),
          { label: isBuyer ? "Total payé" : "Montant de la vente", value: input.total },
        ),
        isBuyer
          ? blockPanel("Conserve cette facture pour ton historique d'achat. Elle est aussi disponible dans ton espace membre.")
          : blockPanel(
              "Le montant net a été crédité sur ton solde vendeur : il devient retirable après la clôture de la garantie acheteur.",
              "success",
            ),
      ],
      cta: {
        label: isBuyer ? "Voir mes achats" : "Voir mes ventes",
        url: appUrl(isBuyer ? "/marketplace/achats" : "/dashboard/ventes", locale),
      },
    }),
  };
}

/** Récapitulatif de montant réutilisable (retrait validé, remboursement…). */
export function buildWalletEmail(input: {
  title: string;
  eyebrow?: string;
  message: string;
  amount: string;
  caption: string;
  displayName?: string | null;
  locale?: string;
}): NotificationEmail {
  const locale = input.locale ?? "fr";
  return {
    subject: `${input.title} — The Park`,
    html: renderEmail({
      eyebrow: input.eyebrow ?? "Portefeuille",
      title: input.title,
      preheader: `${input.title} — ${input.amount}`,
      recipientName: input.displayName ?? null,
      tone: "gold",
      locale,
      body: [esc(input.message)],
      blocks: [blockAmount(input.amount, input.caption)],
      cta: { label: "Voir mon portefeuille", url: appUrl("/portefeuille", locale) },
    }),
  };
}
