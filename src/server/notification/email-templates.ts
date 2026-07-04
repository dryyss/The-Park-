import "server-only";
import type { NotificationType } from "@/generated/prisma/client";

export interface NotificationEmail {
  subject: string;
  html: string;
}

const APP_NAME = "The Park";

function wrap(body: string): string {
  return `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1E2424">
    <p style="font-size:12px;letter-spacing:2px;color:#D6004F;text-transform:uppercase">${APP_NAME}</p>
    ${body}
    <p style="margin-top:24px;font-size:11px;color:#888">Tu peux désactiver ces e-mails dans Paramètres → Notifications.</p>
  </div>`;
}

/** Sujet + corps HTML pour les notifications transactionnelles. */
export function buildNotificationEmail(
  type: NotificationType,
  payload: Record<string, unknown> = {},
): NotificationEmail | null {
  switch (type) {
    case "EXCHANGE_PROPOSED":
      return {
        subject: "Nouvelle proposition d'échange",
        html: wrap("<p>Quelqu'un t'a proposé un échange sur The Park. Connecte-toi pour répondre.</p>"),
      };
    case "EXCHANGE_ACCEPTED":
      return {
        subject: "Échange accepté",
        html: wrap("<p>Ton échange a été accepté. Prépare l'envoi ou consulte le flux sécurisé.</p>"),
      };
    case "EXCHANGE_COMPLETED":
      return {
        subject: "Échange terminé",
        html: wrap("<p>Un échange vient de se clôturer sur The Park.</p>"),
      };
    case "MESSAGE_RECEIVED": {
      const preview = typeof payload.preview === "string" ? payload.preview : "";
      return {
        subject: "Nouveau message",
        html: wrap(`<p>Nouveau message contextualisé${preview ? ` : « ${preview.slice(0, 120)} »` : "."}</p>`),
      };
    }
    case "AUCTION_OUTBID":
      return {
        subject: "Tu as été surenchéri",
        html: wrap(`<p>Une enchère a dépassé ta mise${payload.amount ? ` (${payload.amount})` : ""}.</p>`),
      };
    case "AUCTION_WON":
      return {
        subject: "Enchère remportée",
        html: wrap(`<p>Félicitations — tu as remporté une enchère${payload.amount ? ` pour ${payload.amount}` : ""}.</p>`),
      };
    case "AUCTION_ENDED":
      return {
        subject: "Enchère terminée",
        html: wrap("<p>Une de tes enchères vient de se terminer. Consulte le détail sur The Park.</p>"),
      };
    case "ORDER_UPDATE":
      return {
        subject: "Mise à jour commande boutique",
        html: wrap("<p>Le statut d'une de tes commandes officielles a changé.</p>"),
      };
    case "PAYMENT_AUTHORIZED":
      return {
        subject: "Caution autorisée",
        html: wrap(`<p>Pré-autorisation enregistrée${payload.amount ? ` (${payload.amount} €)` : ""} pour un envoi sécurisé.</p>`),
      };
    case "BADGE_UNLOCKED":
      return {
        subject: "Nouveau trophée débloqué",
        html: wrap(`<p>Tu as débloqué le badge « ${payload.label ?? payload.code ?? "Trophée"} ».</p>`),
      };
    case "WISHLIST_LISTING": {
      const cardName = typeof payload.cardName === "string" ? payload.cardName : "une carte";
      return {
        subject: "Carte wishlist disponible",
        html: wrap(`<p><strong>${cardName}</strong> vient d'être listée sur le marketplace.</p>`),
      };
    }
    case "WISHLIST_PRICE_DROP": {
      const cardName = typeof payload.cardName === "string" ? payload.cardName : "une carte";
      const price = typeof payload.price === "string" ? payload.price : null;
      const alertPrice = typeof payload.alertPrice === "string" ? payload.alertPrice : null;
      return {
        subject: `Alerte prix — ${cardName}`,
        html: wrap(
          `<p><strong>${cardName}</strong> est en vente${price ? ` à <strong>${price}</strong>` : ""}${alertPrice ? `, sous ton seuil d'alerte (${alertPrice})` : ""}.</p>`,
        ),
      };
    }
    case "SALE_CREATED": {
      const amount = typeof payload.amount === "string" ? payload.amount : "";
      return {
        subject: "Nouvelle vente — paiement reçu",
        html: wrap(`<p>Un acheteur vient de payer ta carte${amount ? ` pour <strong>${amount} €</strong>` : ""}. Prépare l'expédition dès que possible.</p>`),
      };
    }
    case "SHIPMENT_SHIPPED": {
      const tracking = typeof payload.trackingNumber === "string" ? payload.trackingNumber : null;
      const carrier = typeof payload.carrier === "string" ? payload.carrier : null;
      return {
        subject: "Ton colis est en route",
        html: wrap(
          `<p>Le vendeur a expédié ta commande${carrier ? ` via <strong>${carrier}</strong>` : ""}.${tracking ? `<br/>Numéro de suivi : <strong>${tracking}</strong>` : ""}</p>`,
        ),
      };
    }
    case "DISPUTE_OPENED": {
      return {
        subject: "Litige ouvert sur une transaction",
        html: wrap("<p>Un litige vient d'être ouvert sur l'une de tes transactions. Connecte-toi pour y répondre dans les meilleurs délais.</p>"),
      };
    }
    case "LISTING_SOLD": {
      const amount = typeof payload.amount === "string" ? payload.amount : "";
      return {
        subject: "Ta carte a été vendue",
        html: wrap(`<p>Ta carte a été achetée${amount ? ` pour <strong>${amount} €</strong>` : ""}. Les fonds seront libérés après confirmation de réception par l'acheteur.</p>`),
      };
    }
    case "REFERRAL_REWARD": {
      const amount = typeof payload.amount === "string" ? payload.amount : null;
      return {
        subject: "Bonus de parrainage crédité 🎉",
        html: wrap(`<p>Ton parrainage est validé${amount ? ` : <strong>${amount}</strong> de crédits ont été ajoutés à ton portefeuille` : ""}.</p>`),
      };
    }
    case "TICKET_REPLY":
      return {
        subject: "Réponse à ton ticket de support",
        html: wrap("<p>Le support a répondu à ton ticket. Connecte-toi pour consulter la réponse.</p>"),
      };
    default:
      return null;
  }
}
