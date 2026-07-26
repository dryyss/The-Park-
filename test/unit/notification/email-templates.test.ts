import { describe, expect, it } from "vitest";
import type { NotificationType } from "@/generated/prisma/client";
import { buildNotificationEmail } from "@/server/notification/email-templates";
import {
  buildMarketplaceInvoiceEmail,
  buildNewsletterConfirmEmail,
  buildNewsletterWelcomeEmail,
  buildShopOrderConfirmationEmail,
  buildWelcomeEmail,
} from "@/server/notification/transactional-emails";

/** Tous les types de notification déclenchant un e-mail (miroir de l'enum Prisma). */
const NOTIFICATION_TYPES: NotificationType[] = [
  "FRIEND_REQUEST",
  "FRIEND_ACCEPTED",
  "EXCHANGE_PROPOSED",
  "EXCHANGE_ACCEPTED",
  "EXCHANGE_COMPLETED",
  "SALE_CREATED",
  "PAYMENT_AUTHORIZED",
  "SHIPMENT_SHIPPED",
  "SHIPMENT_DELIVERED",
  "GUARANTEE_EXPIRING",
  "DISPUTE_OPENED",
  "DISPUTE_RESOLVED",
  "OFFER_RECEIVED",
  "AUCTION_OUTBID",
  "AUCTION_WON",
  "AUCTION_ENDED",
  "REVIEW_RECEIVED",
  "BADGE_UNLOCKED",
  "LISTING_SOLD",
  "LISTING_IN_CART",
  "LISTING_EXPIRING",
  "WISHLIST_LISTING",
  "WISHLIST_PRICE_DROP",
  "ORDER_UPDATE",
  "SHOP_ORDER_PLACED",
  "MESSAGE_RECEIVED",
  "REFERRAL_REWARD",
  "TICKET_REPLY",
];

describe("templates e-mail — notifications", () => {
  it.each(NOTIFICATION_TYPES)("%s produit un e-mail complet sans payload", (type) => {
    const email = buildNotificationEmail(type, {});
    expect(email, `${type} n'a pas de template`).not.toBeNull();
    expect(email!.subject.length).toBeGreaterThan(3);
    // Charte : logo, wordmark et pied de page présents sur tous les envois.
    expect(email!.html).toContain("/icon-192.png");
    expect(email!.html).toContain("THE PARK");
    // Aucune donnée manquante ne doit fuiter dans le rendu.
    expect(email!.html).not.toContain("undefined");
    expect(email!.html).not.toContain("null");
    expect(email!.html).not.toContain("[object Object]");
  });

  it("injecte les données dynamiques du payload", () => {
    const email = buildNotificationEmail(
      "ORDER_UPDATE",
      { status: "SHIPPED", orderNumber: "TP-2026-57749", trackingNumber: "6A12345678901", shippingMethod: "Lettre suivie" },
      { recipientName: "Kenji", locale: "fr" },
    );
    expect(email!.subject).toContain("TP-2026-57749");
    expect(email!.html).toContain("6A12345678901");
    expect(email!.html).toContain("Lettre suivie");
    expect(email!.html).toContain("Salut Kenji");
  });

  it("distingue l'ajout de suivi d'un changement de statut", () => {
    const tracking = buildNotificationEmail("ORDER_UPDATE", {
      status: "PAID",
      orderNumber: "TP-1",
      trackingNumber: "6A1",
      trackingAdded: true,
    });
    expect(tracking!.subject).toContain("suivi");
  });

  it("échappe le HTML des données saisies en back-office", () => {
    const email = buildNotificationEmail("ORDER_UPDATE", {
      status: "SHIPPED",
      orderNumber: "<script>alert(1)</script>",
    });
    expect(email!.html).not.toContain("<script>");
    expect(email!.html).toContain("&lt;script&gt;");
  });

  it("normalise les montants au format euro français", () => {
    const email = buildNotificationEmail("AUCTION_WON", { amount: "112.5" });
    expect(email!.html).toContain("112,50");
  });

  it("pointe les liens vers la locale du destinataire", () => {
    const fr = buildNotificationEmail("BADGE_UNLOCKED", { label: "Sniper" }, { locale: "fr" });
    const ja = buildNotificationEmail("BADGE_UNLOCKED", { label: "Sniper" }, { locale: "ja" });
    expect(fr!.html).toContain("/fr/trophees");
    expect(ja!.html).toContain("/ja/trophees");
  });
});

describe("templates e-mail — transactionnels", () => {
  it("bienvenue", () => {
    const email = buildWelcomeEmail({ displayName: "Kenji" });
    expect(email.html).toContain("Salut Kenji");
    expect(email.html).toContain("/icon-192.png");
  });

  it("newsletter double opt-in dans les trois langues", () => {
    for (const locale of ["fr", "en", "ja"]) {
      const email = buildNewsletterConfirmEmail({ confirmUrl: "https://x.test/confirm?token=abc", locale });
      expect(email.subject).toContain("The Park");
      expect(email.html).toContain("https://x.test/confirm?token=abc");
    }
    expect(buildNewsletterWelcomeEmail({ locale: "ja" }).html).toContain("登録完了");
  });

  it("confirmation de commande boutique", () => {
    const email = buildShopOrderConfirmationEmail({
      orderNumber: "TP-2026-57749",
      customerName: "Kenji",
      items: [{ name: "Display 20 boosters", sku: "TP-PROMO", quantity: 1, lineTotal: "169,90 €" }],
      subtotal: "169,90 €",
      shippingCost: "0,00 €",
      total: "169,90 €",
      shipping: { name: "Kenji", line1: "5 Place des 7 Fontaines", zip: "95150", city: "Taverny", country: "FR", method: "Lettre suivie" },
      orderUrl: "https://x.test/commande",
    });
    expect(email.subject).toContain("TP-2026-57749");
    expect(email.html).toContain("Display 20 boosters");
    expect(email.html).toContain("Taverny");
    expect(email.html).not.toContain("undefined");
  });

  it("facture marketplace : pas de lien de préférences (document comptable)", () => {
    const email = buildMarketplaceInvoiceEmail({
      role: "buyer",
      invoiceNumber: "FAC-1",
      checkoutNumber: "MP-1",
      recipientName: "Kenji",
      lines: [{ cardName: "Skyline R34", unitPrice: "89,90 €", sellerName: "Yuki" }],
      total: "89,90 €",
    });
    expect(email.html).toContain("FAC-1");
    expect(email.html).not.toContain("Paramètres → Notifications");
  });
});
