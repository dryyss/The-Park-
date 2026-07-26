import { NextResponse } from "next/server";
import type { NotificationType } from "@/generated/prisma/client";
import { buildNotificationEmail, type NotificationEmail } from "@/server/notification/email-templates";
import {
  buildMarketplaceInvoiceEmail,
  buildNewsletterConfirmEmail,
  buildNewsletterWelcomeEmail,
  buildShopOrderConfirmationEmail,
  buildWalletEmail,
  buildWelcomeEmail,
} from "@/server/notification/transactional-emails";

/**
 * Galerie de prévisualisation des e-mails (dev uniquement).
 *
 *   /api/dev/emails            → index de tous les templates
 *   /api/dev/emails?id=<clé>   → rendu HTML d'un template avec des données de démo
 *
 * Désactivée en production : ces pages exposent la mise en forme, pas des données réelles,
 * mais il n'y a aucune raison de les servir publiquement.
 */

const CARD = {
  cardName: "Nissan Skyline R34 GT-R",
  cardSub: "Saison 1 · Holo · Near Mint",
  cardImage: "/uploads/32_NISSAN_SKYLINE_R32.jpg",
};

interface PreviewEntry {
  id: string;
  group: string;
  label: string;
  trigger: string;
  build: () => NotificationEmail | null;
}

function notif(
  id: string,
  group: string,
  label: string,
  trigger: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
  entityId = "demo-id",
): PreviewEntry {
  return {
    id,
    group,
    label,
    trigger,
    build: () =>
      buildNotificationEmail(type, payload, {
        entityId,
        entityType: "DEMO",
        locale: "fr",
        recipientName: "Kenji",
      }),
  };
}

const ENTRIES: PreviewEntry[] = [
  // ---- Compte -------------------------------------------------------------
  {
    id: "welcome",
    group: "Compte",
    label: "Bienvenue",
    trigger: "Création du compte (auth-sync)",
    build: () => buildWelcomeEmail({ displayName: "Kenji" }),
  },
  {
    id: "newsletter-confirm",
    group: "Compte",
    label: "Newsletter — confirmation (double opt-in)",
    trigger: "Inscription newsletter",
    build: () => buildNewsletterConfirmEmail({ confirmUrl: "https://thepark.app/api/newsletter/confirm?token=demo" }),
  },
  {
    id: "newsletter-welcome",
    group: "Compte",
    label: "Newsletter — bienvenue",
    trigger: "Clic sur le lien de confirmation",
    build: () => buildNewsletterWelcomeEmail({ unsubscribeUrl: "https://thepark.app/api/newsletter/unsubscribe?token=demo" }),
  },

  // ---- Boutique -----------------------------------------------------------
  {
    id: "shop-confirmation",
    group: "Boutique",
    label: "Confirmation de commande",
    trigger: "Paiement Stripe encaissé",
    build: () =>
      buildShopOrderConfirmationEmail({
        orderNumber: "TP-2026-57749",
        customerName: "Kenji",
        items: [
          { name: "Display 20 boosters Moteur Forgé Réédition", sku: "TP-PROMO-LAUNCH", quantity: 1, lineTotal: "169,90 €" },
          { name: "Booster Saison 1", sku: "TP-S01-BST", quantity: 3, lineTotal: "17,70 €" },
        ],
        subtotal: "187,60 €",
        shippingCost: "0,00 €",
        total: "187,60 €",
        shipping: {
          name: "The Park Owner",
          line1: "5 Place des 7 Fontaines",
          zip: "95150",
          city: "Taverny",
          country: "FR",
          method: "Lettre suivie",
        },
        orderUrl: "https://thepark.app/fr/boutique/commandes/demo",
      }),
  },
  notif("order-preparing", "Boutique", "Commande en préparation", "Statut → PREPARING", "ORDER_UPDATE", {
    status: "PREPARING",
    orderNumber: "TP-2026-57749",
    total: "187.60",
    shippingMethod: "Lettre suivie",
  }),
  notif("order-shipped", "Boutique", "Commande expédiée", "Statut → SHIPPED", "ORDER_UPDATE", {
    status: "SHIPPED",
    orderNumber: "TP-2026-57749",
    trackingNumber: "6A12345678901",
    shippingMethod: "Lettre suivie",
    total: "187.60",
  }),
  notif("order-tracking", "Boutique", "Numéro de suivi ajouté", "Suivi saisi sans changement de statut", "ORDER_UPDATE", {
    status: "PAID",
    orderNumber: "TP-2026-57749",
    trackingNumber: "6A12345678901",
    shippingMethod: "Lettre suivie",
    trackingAdded: true,
  }),
  notif("order-delivered", "Boutique", "Commande livrée", "Statut → DELIVERED", "ORDER_UPDATE", {
    status: "DELIVERED",
    orderNumber: "TP-2026-57749",
  }),
  notif("order-cancelled", "Boutique", "Commande annulée", "Statut → CANCELLED", "ORDER_UPDATE", {
    status: "CANCELLED",
    orderNumber: "TP-2026-57749",
  }),
  notif("order-refunded", "Boutique", "Commande remboursée", "Statut → REFUNDED", "ORDER_UPDATE", {
    status: "REFUNDED",
    orderNumber: "TP-2026-57749",
    total: "187.60",
  }),
  notif("shop-staff", "Boutique", "Staff — nouvelle commande", "Paiement encaissé (back-office)", "SHOP_ORDER_PLACED", {
    orderNumber: "TP-2026-57749",
    buyer: "Kenji",
    total: "187.60",
    itemCount: "4",
    orderUrl: "https://thepark.app/fr/admin/commandes/demo",
  }),

  // ---- Marketplace --------------------------------------------------------
  notif("listing-sold", "Marketplace", "Carte vendue", "Achat confirmé", "LISTING_SOLD", {
    ...CARD,
    amount: "89.90",
    actorName: "Yuki",
  }),
  notif("sale-created", "Marketplace", "Paiement reçu (vendeur)", "Pré-autorisation acquise", "SALE_CREATED", {
    ...CARD,
    amount: "89.90",
  }),
  notif("offer-received", "Marketplace", "Offre reçue", "Offre sur une annonce", "OFFER_RECEIVED", {
    ...CARD,
    amount: "75.00",
    actorName: "Yuki",
  }),
  notif("listing-in-cart", "Marketplace", "Annonce mise au panier", "Ajout au panier acheteur", "LISTING_IN_CART", {
    ...CARD,
    buyer: "Yuki",
  }),
  notif("listing-expiring", "Marketplace", "Annonce bientôt expirée", "Cron d'expiration", "LISTING_EXPIRING", {
    ...CARD,
    price: "89.90",
    expiresAt: "2026-08-02T18:00:00.000Z",
  }),
  notif("shipment-shipped", "Marketplace", "Colis expédié", "Vendeur saisit le suivi", "SHIPMENT_SHIPPED", {
    ...CARD,
    trackingNumber: "6A12345678901",
    carrier: "Colissimo",
  }),
  notif("shipment-delivered", "Marketplace", "Colis livré", "Statut transporteur", "SHIPMENT_DELIVERED"),
  notif("guarantee-expiring", "Marketplace", "Fin de garantie", "J-1 avant clôture auto", "GUARANTEE_EXPIRING", {
    deadline: "2026-08-01T12:00:00.000Z",
  }),
  notif("dispute-opened", "Marketplace", "Litige ouvert", "Ouverture d'un litige", "DISPUTE_OPENED", {
    reason: "La carte reçue présente un pli sur le bord droit, non visible sur l'annonce.",
  }),
  notif("dispute-resolved", "Marketplace", "Litige tranché", "Décision du staff", "DISPUTE_RESOLVED", {
    outcome: "remboursement partiel de 40 %",
    amount: "35.96",
  }),
  notif("review-received", "Marketplace", "Avis reçu", "Avis publié après transaction", "REVIEW_RECEIVED", {
    actorName: "Yuki",
    rating: "5",
    comment: "Envoi ultra soigné, carte conforme, communication au top.",
  }),
  {
    id: "invoice-buyer",
    group: "Marketplace",
    label: "Facture d'achat",
    trigger: "Checkout marketplace payé",
    build: () =>
      buildMarketplaceInvoiceEmail({
        role: "buyer",
        invoiceNumber: "FAC-MP-2026-0142-ACH",
        checkoutNumber: "MP-2026-0142",
        recipientName: "Kenji",
        lines: [
          { cardName: "Nissan Skyline R34 GT-R", unitPrice: "89,90 €", sellerName: "Yuki" },
          { cardName: "Mazda RX-7 FD", unitPrice: "42,00 €", sellerName: "Aiko" },
        ],
        total: "131,90 €",
      }),
  },
  {
    id: "invoice-seller",
    group: "Marketplace",
    label: "Facture de vente",
    trigger: "Checkout marketplace payé",
    build: () =>
      buildMarketplaceInvoiceEmail({
        role: "seller",
        invoiceNumber: "FAC-MP-2026-0142-V1",
        checkoutNumber: "MP-2026-0142",
        recipientName: "Yuki",
        lines: [{ cardName: "Nissan Skyline R34 GT-R", unitPrice: "89,90 €" }],
        total: "89,90 €",
      }),
  },

  // ---- Enchères -----------------------------------------------------------
  notif("auction-outbid", "Enchères", "Surenchéri", "Mise supérieure placée", "AUCTION_OUTBID", {
    ...CARD,
    amount: "112.00",
  }),
  notif("auction-won", "Enchères", "Enchère remportée", "Clôture avec gagnant", "AUCTION_WON", {
    ...CARD,
    amount: "112.00",
  }),
  notif("auction-ended-sold", "Enchères", "Vente conclue (vendeur)", "Clôture, réserve atteinte", "AUCTION_ENDED", {
    ...CARD,
    amount: "112.00",
    sold: "true",
  }),
  notif("auction-ended-unsold", "Enchères", "Sans preneur (vendeur)", "Clôture, réserve non atteinte", "AUCTION_ENDED", {
    ...CARD,
    amount: "80.00",
    sold: "false",
  }),

  // ---- Échanges -----------------------------------------------------------
  notif("exchange-proposed", "Échanges", "Proposition reçue", "Échange proposé", "EXCHANGE_PROPOSED", {
    actorName: "Yuki",
    cardCount: "3",
    message: "Je te propose mes trois Nissan contre ta RX-7, dis-moi ce que tu en penses.",
  }),
  notif("exchange-accepted", "Échanges", "Échange accepté", "Acceptation", "EXCHANGE_ACCEPTED", { actorName: "Yuki" }),
  notif("exchange-completed", "Échanges", "Échange terminé", "Double réception confirmée", "EXCHANGE_COMPLETED"),
  notif("payment-authorized", "Échanges", "Caution autorisée", "Pré-autorisation Stripe", "PAYMENT_AUTHORIZED", {
    amount: "120.00",
  }),

  // ---- Communauté ---------------------------------------------------------
  notif("friend-request", "Communauté", "Demande d'ami", "Demande envoyée", "FRIEND_REQUEST", { actorName: "Yuki" }),
  notif("friend-accepted", "Communauté", "Demande acceptée", "Acceptation", "FRIEND_ACCEPTED", { actorName: "Yuki" }),
  notif("message-received", "Communauté", "Nouveau message", "Message en conversation", "MESSAGE_RECEIVED", {
    actorName: "Yuki",
    preview: "Salut ! Toujours dispo pour l'échange sur la R34 ?",
  }),

  // ---- Collection ---------------------------------------------------------
  notif("wishlist-listing", "Collection", "Carte wishlist en vente", "Mise en vente d'une carte suivie", "WISHLIST_LISTING", {
    ...CARD,
    price: "89.90",
  }),
  notif("wishlist-price-drop", "Collection", "Alerte prix", "Prix sous le seuil d'alerte", "WISHLIST_PRICE_DROP", {
    ...CARD,
    price: "72.00",
    alertPrice: "80.00",
  }),
  notif("badge-unlocked", "Collection", "Trophée débloqué", "Condition de badge remplie", "BADGE_UNLOCKED", {
    label: "Sniper de l'Ombre",
    description: "Remporter une enchère dans les 15 dernières secondes.",
  }),

  // ---- Portefeuille & support --------------------------------------------
  notif("referral-reward", "Portefeuille", "Bonus de parrainage", "Filleul qualifié", "REFERRAL_REWARD", {
    amount: "2",
    code: "KENJI42",
  }),
  {
    id: "wallet-withdrawal",
    group: "Portefeuille",
    label: "Retrait validé (générique)",
    trigger: "Virement vendeur exécuté",
    build: () =>
      buildWalletEmail({
        title: "Ton retrait est parti",
        message: "Le virement vers ton compte bancaire a été déclenché. Compte 1 à 3 jours ouvrés selon ta banque.",
        amount: "248,50 €",
        caption: "Montant viré",
        displayName: "Yuki",
      }),
  },
  notif("ticket-reply", "Support", "Réponse du support", "Message staff sur un ticket", "TICKET_REPLY", {
    subject: "Colis non reçu — commande TP-2026-57749",
    preview: "Bonjour Kenji, nous avons relancé le transporteur, voici le nouveau statut du colis…",
  }),
];

function indexPage(): string {
  const groups = [...new Set(ENTRIES.map((e) => e.group))];
  const sections = groups
    .map((group) => {
      const rows = ENTRIES.filter((e) => e.group === group)
        .map(
          (e) => `<tr>
            <td><a href="?id=${e.id}" target="preview">${e.label}</a></td>
            <td class="trigger">${e.trigger}</td>
            <td class="id">${e.id}</td>
          </tr>`,
        )
        .join("");
      return `<h2>${group}</h2><table>${rows}</table>`;
    })
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
  <title>The Park — templates e-mail</title>
  <style>
    body{margin:0;background:#0e0e11;color:#f2efe9;font-family:system-ui,sans-serif;display:flex;height:100vh}
    aside{width:440px;overflow:auto;padding:24px;border-right:1px solid #26262b}
    iframe{flex:1;border:0;background:#0e0e11}
    h1{font-size:18px;letter-spacing:2px;text-transform:uppercase}
    h2{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d81b60;margin:22px 0 6px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:6px 8px 6px 0;border-bottom:1px solid #1f1f24;vertical-align:top}
    a{color:#f2efe9}
    .trigger{color:#8e8e98;font-size:11px}
    .id{color:#4b4b54;font-size:10px;font-family:monospace}
    p.hint{color:#8e8e98;font-size:12px;line-height:1.6}
  </style></head><body>
  <aside>
    <h1>Templates e-mail</h1>
    <p class="hint">${ENTRIES.length} templates. Clique pour prévisualiser le rendu réel (données de démo).</p>
    ${sections}
  </aside>
  <iframe name="preview" src="?id=${ENTRIES[0]!.id}"></iframe>
  </body></html>`;
}

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return new NextResponse(indexPage(), { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const entry = ENTRIES.find((e) => e.id === id);
  const email = entry?.build();
  if (!email) return new NextResponse("Template inconnu", { status: 404 });

  return new NextResponse(email.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
