import "server-only";
import type { NotificationType } from "@/generated/prisma/client";
import { notificationHref } from "@/lib/notification-display";
import {
  appUrl,
  b,
  blockAmount,
  blockCardItem,
  blockCode,
  blockData,
  blockPanel,
  blockQuote,
  blockSteps,
  dateLabel,
  esc,
  money,
  renderEmail,
  str,
  type EmailTone,
} from "@/server/notification/email-layout";

export interface NotificationEmail {
  subject: string;
  html: string;
}

/** Contexte d'envoi : sert à construire le lien d'action et à personnaliser l'e-mail. */
export interface NotificationEmailContext {
  entityType?: string | null;
  entityId?: string | null;
  /** Locale du destinataire (préfixe des liens). */
  locale?: string;
  /** Pseudo du destinataire — « Salut Kenji, ». */
  recipientName?: string | null;
}

type Payload = Record<string, unknown>;

/** Lien d'action par défaut : la page vers laquelle pointe déjà la notification in-app. */
function actionUrl(type: NotificationType, ctx: NotificationEmailContext, fallback = "/"): string {
  const href = notificationHref(type, ctx.entityType ?? null, ctx.entityId ?? null) ?? fallback;
  return appUrl(href, ctx.locale ?? "fr");
}

/** Auteur de l'action (« Kenji », sinon formulation neutre). */
function actor(payload: Payload, fallback = "Un membre"): string {
  return str(payload, "actorName") ?? str(payload, "buyer") ?? str(payload, "seller") ?? fallback;
}

function cardBlock(payload: Payload, right?: string | null): string {
  const name = str(payload, "cardName") ?? str(payload, "card");
  if (!name) return "";
  return blockCardItem({
    name,
    sub: str(payload, "cardSub") ?? str(payload, "versionLabel") ?? str(payload, "seasonName"),
    image: str(payload, "cardImage"),
    right: right ?? null,
  });
}

interface TemplateSpec {
  subject: string;
  eyebrow: string;
  title: string;
  tone?: EmailTone;
  preheader?: string;
  body: string[];
  blocks?: string[];
  cta?: { label: string; url: string } | null;
  footerNote?: string | null;
}

/**
 * Sujet + corps HTML des e-mails transactionnels déclenchés par une notification.
 *
 * Chaque template dégrade proprement : si le payload ne contient pas la donnée
 * enrichie (nom de carte, montant, visuel…), la phrase reste correcte sans elle.
 */
export function buildNotificationEmail(
  type: NotificationType,
  payload: Payload = {},
  ctx: NotificationEmailContext = {},
): NotificationEmail | null {
  const spec = buildSpec(type, payload, ctx);
  if (!spec) return null;

  return {
    subject: spec.subject,
    html: renderEmail({
      eyebrow: spec.eyebrow,
      title: spec.title,
      preheader: spec.preheader ?? spec.subject,
      recipientName: ctx.recipientName ?? null,
      body: spec.body,
      blocks: spec.blocks,
      cta: spec.cta === null ? null : (spec.cta ?? { label: "Ouvrir The Park", url: actionUrl(type, ctx) }),
      footerNote: spec.footerNote ?? null,
      tone: spec.tone ?? "brand",
      locale: ctx.locale ?? "fr",
    }),
  };
}

/** Un cas par type de notification : switch exhaustif, volontairement plat. */
function buildSpec(type: NotificationType, payload: Payload, ctx: NotificationEmailContext): TemplateSpec | null {
  const amount = money(payload.amount);

  switch (type) {
    // ---------------------------------------------------------------- Social
    case "FRIEND_REQUEST": {
      const name = actor(payload);
      return {
        subject: `${name} veut te suivre`,
        eyebrow: "Communauté",
        title: "Nouvelle demande d'ami",
        tone: "trade",
        body: [
          `${b(name)} souhaite rejoindre ton cercle. Une fois la demande acceptée, vous voyez vos collections respectives et vos doublons échangeables.`,
        ],
        cta: { label: "Voir la demande", url: appUrl("/rivaux", ctx.locale) },
      };
    }
    case "FRIEND_ACCEPTED": {
      const name = actor(payload);
      return {
        subject: `${name} a accepté ta demande`,
        eyebrow: "Communauté",
        title: "Demande acceptée",
        tone: "trade",
        body: [
          `${b(name)} fait maintenant partie de tes contacts. Compare vos classeurs pour repérer les cartes qui vous manquent mutuellement.`,
        ],
        cta: { label: "Comparer les collections", url: appUrl("/rivaux", ctx.locale) },
      };
    }
    case "MESSAGE_RECEIVED": {
      const name = actor(payload);
      const preview = str(payload, "preview");
      return {
        subject: `Nouveau message de ${name}`,
        eyebrow: "Messagerie",
        title: "Tu as un nouveau message",
        body: [`${b(name)} t'a écrit sur The Park.`],
        blocks: [preview ? blockQuote(preview.slice(0, 160), name) : ""],
        cta: { label: "Répondre", url: actionUrl(type, ctx, "/messages") },
      };
    }

    // -------------------------------------------------------------- Échanges
    case "EXCHANGE_PROPOSED": {
      const name = actor(payload);
      const message = str(payload, "message");
      const count = str(payload, "cardCount");
      return {
        subject: `${name} te propose un échange`,
        eyebrow: "Échanges",
        title: "Nouvelle proposition d'échange",
        tone: "trade",
        body: [
          `${b(name)} te propose un échange${count ? ` portant sur ${b(count)} carte(s)` : ""}. Tu peux accepter, refuser ou contre-proposer depuis ton espace échanges.`,
        ],
        blocks: [message ? blockQuote(message.slice(0, 200), name) : ""],
        cta: { label: "Voir la proposition", url: actionUrl(type, ctx, "/echanges") },
        footerNote: "Sans réponse de ta part, la proposition reste en attente : rien n'est débité ni réservé.",
      };
    }
    case "EXCHANGE_ACCEPTED": {
      const name = actor(payload);
      return {
        subject: "Ton échange a été accepté",
        eyebrow: "Échanges",
        title: "Échange accepté",
        tone: "success",
        body: [`${b(name)} a accepté ton échange. Place à l'expédition.`],
        blocks: [
          blockSteps([
            "Prépare tes cartes (sleeve + toploader, calage rigide).",
            "Filme la mise sous pli si l'échange est en mode sécurisé.",
            "Renseigne le numéro de suivi dès le dépôt en bureau de poste.",
          ]),
        ],
        cta: { label: "Préparer l'envoi", url: actionUrl(type, ctx, "/echanges") },
      };
    }
    case "EXCHANGE_COMPLETED":
      return {
        subject: "Échange terminé",
        eyebrow: "Échanges",
        title: "Échange bouclé",
        tone: "success",
        body: [
          "Les deux colis sont arrivés : l'échange est clôturé et les cautions éventuelles ont été libérées.",
          "Les cartes ont été transférées dans vos collections respectives.",
        ],
        blocks: [
          blockPanel(
            "Un avis en deux clics aide toute la communauté à identifier les membres fiables.",
            "success",
          ),
        ],
        cta: { label: "Laisser un avis", url: actionUrl(type, ctx, "/echanges") },
      };
    case "PAYMENT_AUTHORIZED":
      return {
        subject: "Caution autorisée",
        eyebrow: "Échange sécurisé",
        title: "Ta caution est enregistrée",
        tone: "gold",
        body: [
          "La pré-autorisation bancaire est en place pour cet échange sécurisé. Aucun montant n'est débité : il est simplement bloqué jusqu'à la clôture.",
        ],
        blocks: [amount ? blockAmount(amount, "Montant pré-autorisé") : ""],
        cta: { label: "Voir mon portefeuille", url: appUrl("/portefeuille", ctx.locale) },
        footerNote: "La caution est libérée automatiquement à la réception confirmée des deux colis.",
      };
    case "GUARANTEE_EXPIRING":
      return {
        subject: "Fin de garantie imminente",
        eyebrow: "Échange sécurisé",
        title: "Ta fenêtre de garantie se termine",
        tone: "warning",
        body: [
          "La période pendant laquelle tu peux signaler un problème sur cette transaction arrive à son terme.",
          `Si le colis est conforme, tu n'as rien à faire : la transaction se clôture seule${dateLabel(payload.deadline) ? ` le ${b(dateLabel(payload.deadline))}` : ""}.`,
        ],
        blocks: [
          blockPanel(
            "Un souci avec la carte reçue (état, contenu, colis vide) ? Ouvre un litige <strong>avant</strong> la fin du délai, photos à l'appui.",
            "warning",
          ),
        ],
        cta: { label: "Vérifier ma réception", url: actionUrl(type, ctx, "/marketplace/achats") },
      };

    // ------------------------------------------------------------- Enchères
    case "AUCTION_OUTBID":
      return {
        subject: "Tu as été surenchéri",
        eyebrow: "Enchères",
        title: "Quelqu'un est passé devant toi",
        tone: "warning",
        body: [
          `Ta mise n'est plus la meilleure${amount ? ` : l'enchère est montée à ${b(amount)}` : ""}. Il te reste un peu de temps pour reprendre la main.`,
        ],
        blocks: [cardBlock(payload, amount)],
        cta: { label: "Renchérir", url: actionUrl(type, ctx, "/encheres") },
        footerNote: "Toute mise placée dans les dernières minutes prolonge la vente de 2 minutes (anti-snipe).",
      };
    case "AUCTION_WON":
      return {
        subject: "Enchère remportée 🏁",
        eyebrow: "Enchères",
        title: "La carte est à toi",
        tone: "success",
        body: [
          `Félicitations, tu remportes cette enchère${amount ? ` pour ${b(amount)}` : ""}. Finalise le paiement pour que le vendeur lance l'expédition.`,
        ],
        blocks: [cardBlock(payload, amount), amount ? blockAmount(amount, "Montant à régler") : ""],
        cta: { label: "Finaliser l'achat", url: actionUrl(type, ctx, "/encheres") },
      };
    case "AUCTION_ENDED": {
      const sold = str(payload, "sold") === "true";
      return {
        subject: sold ? "Ton enchère est vendue" : "Ton enchère est terminée",
        eyebrow: "Enchères",
        title: sold ? "Vendue !" : "Enchère terminée sans preneur",
        tone: sold ? "success" : "brand",
        body: sold
          ? [
              `Ta vente aux enchères s'est conclue${amount ? ` à ${b(amount)}` : ""}. Prépare l'expédition dès réception du paiement.`,
            ]
          : [
              "Ta vente aux enchères est arrivée à son terme sans atteindre le prix de réserve. La carte reste dans ta collection.",
              "Tu peux la remettre en vente avec un prix de départ ajusté, ou la proposer au prix fixe sur le marketplace.",
            ],
        blocks: [cardBlock(payload, amount)],
        cta: {
          label: sold ? "Voir la vente" : "Remettre en vente",
          url: actionUrl(type, ctx, sold ? "/dashboard/ventes" : "/vendre"),
        },
      };
    }

    // ---------------------------------------------------------- Marketplace
    case "OFFER_RECEIVED":
      return {
        subject: "Nouvelle offre sur ton annonce",
        eyebrow: "Marketplace",
        title: "Tu as reçu une offre",
        tone: "gold",
        body: [
          `${b(actor(payload))} te propose${amount ? ` ${b(amount)}` : " un prix"} pour l'une de tes cartes en vente.`,
        ],
        blocks: [cardBlock(payload, amount)],
        cta: { label: "Répondre à l'offre", url: actionUrl(type, ctx, "/marketplace") },
      };
    case "LISTING_IN_CART":
      return {
        subject: "Ta carte est dans un panier",
        eyebrow: "Marketplace",
        title: "Un acheteur a réservé ta carte",
        body: [
          `${b(actor(payload))} vient d'ajouter ta carte à son panier : l'annonce est réservée le temps qu'il finalise son paiement.`,
        ],
        blocks: [cardBlock(payload)],
        cta: { label: "Voir mes annonces", url: actionUrl(type, ctx, "/marketplace") },
        footerNote: "Si le paiement n'aboutit pas, la réservation expire et l'annonce redevient visible automatiquement.",
      };
    case "LISTING_EXPIRING":
      return {
        subject: "Ton annonce expire bientôt",
        eyebrow: "Marketplace",
        title: "Annonce bientôt hors ligne",
        tone: "warning",
        body: [
          `Ton annonce arrive en fin de publication${dateLabel(payload.expiresAt) ? ` (${b(dateLabel(payload.expiresAt))})` : ""}. Prolonge-la ou ajuste son prix pour rester visible.`,
        ],
        blocks: [cardBlock(payload, money(payload.price))],
        cta: { label: "Gérer mes annonces", url: actionUrl(type, ctx, "/marketplace") },
      };
    case "LISTING_SOLD":
      return {
        subject: "Ta carte a été vendue 🎉",
        eyebrow: "Marketplace",
        title: "Vendu !",
        tone: "success",
        body: [
          `${b(actor(payload, "Un acheteur"))} vient d'acheter ta carte${amount ? ` pour ${b(amount)}` : ""}. Les fonds sont sécurisés et te seront versés après confirmation de réception.`,
        ],
        blocks: [
          cardBlock(payload, amount),
          blockSteps([
            "Expédie sous 5 jours ouvrés (au-delà, la vente est annulée et remboursée).",
            "Renseigne le numéro de suivi dans ton espace ventes.",
            "Les fonds sont libérés à la confirmation de réception de l'acheteur.",
          ]),
        ],
        cta: { label: "Préparer l'expédition", url: appUrl("/dashboard/ventes", ctx.locale) },
      };
    case "SALE_CREATED":
      return {
        subject: "Paiement reçu — carte à expédier",
        eyebrow: "Marketplace",
        title: "Nouvelle vente à expédier",
        tone: "success",
        body: [
          `Le paiement${amount ? ` de ${b(amount)}` : ""} est sécurisé sur The Park. Tu peux préparer le colis en toute confiance.`,
        ],
        blocks: [cardBlock(payload, amount)],
        cta: { label: "Voir la vente", url: actionUrl(type, ctx, "/dashboard/ventes") },
        footerNote: "Photographie ou filme la mise sous pli : c'est ta meilleure protection en cas de litige.",
      };
    case "SHIPMENT_SHIPPED": {
      const tracking = str(payload, "trackingNumber");
      const carrier = str(payload, "carrier") ?? str(payload, "shippingMethod");
      return {
        subject: "Ton colis est en route 📦",
        eyebrow: "Expédition",
        title: "Le vendeur a expédié ton colis",
        tone: "success",
        body: [`Ta commande vient de partir${carrier ? ` via ${b(carrier)}` : ""}.`],
        blocks: [
          cardBlock(payload),
          tracking ? blockCode(tracking, "Numéro de suivi") : "",
          blockPanel(
            "À la réception, ouvre le colis en filmant si possible, puis confirme la réception dans l'app pour libérer les fonds du vendeur.",
            "success",
          ),
        ],
        cta: { label: "Suivre ma commande", url: actionUrl(type, ctx, "/marketplace/achats") },
      };
    }
    case "SHIPMENT_DELIVERED":
      return {
        subject: "Colis livré — confirme la réception",
        eyebrow: "Expédition",
        title: "Ton colis a été livré",
        tone: "success",
        body: [
          "Le transporteur indique que le colis est arrivé. Vérifie la carte et confirme la réception pour clôturer la transaction.",
        ],
        blocks: [
          blockPanel(
            "Sans action de ta part, la transaction se clôture automatiquement à la fin de la fenêtre de garantie.",
            "success",
          ),
        ],
        cta: { label: "Confirmer la réception", url: actionUrl(type, ctx, "/marketplace/achats") },
      };
    case "DISPUTE_OPENED": {
      const reason = str(payload, "reason");
      return {
        subject: "Litige ouvert sur une transaction",
        eyebrow: "Litige",
        title: "Un litige a été ouvert",
        tone: "danger",
        body: [
          "Un litige vient d'être déclaré sur l'une de tes transactions. Le versement des fonds est gelé le temps de l'instruction.",
          "Réponds au plus vite avec tes preuves (photos, vidéo de mise sous pli, preuve de dépôt) : c'est ce qui départage les dossiers.",
        ],
        blocks: [reason ? blockQuote(reason.slice(0, 240), "Motif invoqué") : ""],
        cta: { label: "Répondre au litige", url: actionUrl(type, ctx, "/dashboard") },
      };
    }
    case "DISPUTE_RESOLVED": {
      const outcome = str(payload, "outcome");
      return {
        subject: "Litige clôturé",
        eyebrow: "Litige",
        title: "Décision rendue sur ton litige",
        tone: "brand",
        body: [
          `L'équipe The Park a tranché${outcome ? ` : ${b(outcome)}` : ""}. Le détail de la décision est consultable dans ton espace.`,
        ],
        blocks: [amount ? blockAmount(amount, "Montant concerné") : ""],
        cta: { label: "Voir la décision", url: actionUrl(type, ctx, "/dashboard") },
      };
    }
    case "REVIEW_RECEIVED": {
      const rating = str(payload, "rating");
      const comment = str(payload, "comment");
      const stars = rating ? "★".repeat(Math.max(0, Math.min(5, Number(rating)))) : null;
      return {
        subject: "Tu as reçu un nouvel avis",
        eyebrow: "Réputation",
        title: "Nouvel avis sur ton profil",
        tone: "gold",
        body: [`${b(actor(payload))} a évalué votre transaction.`],
        blocks: [
          stars ? blockData([{ label: "Note", value: `${esc(stars)} <span style="color:#6e6e78">${esc(rating)}/5</span>`, tone: "gold" }]) : "",
          comment ? blockQuote(comment.slice(0, 240), actor(payload)) : "",
        ],
        cta: { label: "Voir mon profil", url: appUrl("/profil", ctx.locale) },
      };
    }

    // ------------------------------------------------------ Boutique (shop)
    case "ORDER_UPDATE":
      return shopOrderSpec(payload, ctx);
    case "SHOP_ORDER_PLACED": {
      const num = str(payload, "orderNumber");
      const total = money(payload.total);
      const items = str(payload, "itemCount");
      const url = str(payload, "orderUrl");
      return {
        subject: `Nouvelle commande boutique${num ? ` — n°${num}` : ""}`,
        eyebrow: "Back-office",
        title: "Commande à préparer",
        tone: "gold",
        body: [`${b(actor(payload, "Un client"))} vient de passer commande sur la boutique officielle. Paiement encaissé.`],
        blocks: [
          blockData([
            { label: "Commande", value: num ? esc(num) : "—" },
            { label: "Articles", value: items ? `${esc(items)} article(s)` : "—" },
            { label: "Total", value: total ? esc(total) : "—", tone: "gold" },
          ]),
        ],
        cta: { label: "Ouvrir la commande", url: url ?? actionUrl(type, ctx, "/admin/commandes") },
      };
    }

    // ----------------------------------------------- Collection / wishlist
    case "WISHLIST_LISTING": {
      const name = str(payload, "cardName") ?? "Une carte de ta wishlist";
      const price = money(payload.price);
      return {
        subject: `Wishlist — ${name} est disponible`,
        eyebrow: "Wishlist",
        title: "Une carte de ta liste vient d'être mise en vente",
        body: [
          `${b(name)} est désormais disponible sur le marketplace${price ? ` à ${b(price)}` : ""}. Les cartes recherchées partent vite.`,
        ],
        blocks: [cardBlock(payload, price)],
        cta: { label: "Voir l'annonce", url: actionUrl(type, ctx, "/wishlist") },
      };
    }
    case "WISHLIST_PRICE_DROP": {
      const name = str(payload, "cardName") ?? "Une carte de ta wishlist";
      const price = money(payload.price);
      const alertPrice = money(payload.alertPrice);
      return {
        subject: `Alerte prix — ${name}`,
        eyebrow: "Wishlist",
        title: "Le prix est passé sous ton seuil",
        tone: "gold",
        body: [
          `${b(name)} est en vente${price ? ` à ${b(price)}` : ""}${alertPrice ? `, sous ton alerte fixée à ${b(alertPrice)}` : ""}.`,
        ],
        blocks: [
          cardBlock(payload, price),
          price && alertPrice
            ? blockData([
                { label: "Prix affiché", value: esc(price), tone: "gold" },
                { label: "Ton seuil d'alerte", value: esc(alertPrice) },
              ])
            : "",
        ],
        cta: { label: "Voir l'annonce", url: actionUrl(type, ctx, "/wishlist") },
      };
    }
    case "BADGE_UNLOCKED": {
      const label = str(payload, "label") ?? str(payload, "code") ?? "Nouveau trophée";
      const description = str(payload, "description");
      return {
        subject: `Trophée débloqué — ${label}`,
        eyebrow: "Trophées",
        title: "Nouveau trophée débloqué",
        tone: "badge",
        body: [`Bien joué : tu viens de débloquer ${b(label)}.`],
        blocks: [
          blockPanel(
            `<div style="font-family:'Arial Black',sans-serif;font-size:16px;color:#f2efe9">★ ${esc(label)}</div>${description ? `<div style="margin-top:6px">${esc(description)}</div>` : ""}`,
            "badge",
          ),
        ],
        cta: { label: "Voir mes trophées", url: appUrl("/trophees", ctx.locale) },
      };
    }

    // ------------------------------------------------ Portefeuille / parrainage
    case "REFERRAL_REWARD": {
      const bonus = money(payload.amount) ?? str(payload, "amount");
      const code = str(payload, "code");
      return {
        subject: "Bonus de parrainage crédité 🎉",
        eyebrow: "Parrainage",
        title: "Ton bonus est crédité",
        tone: "gold",
        body: ["Le parrainage est validé : le bonus a été ajouté à ton solde The Park, utilisable immédiatement."],
        blocks: [bonus ? blockAmount(bonus, "Crédité sur ton portefeuille") : "", code ? blockCode(code, "Ton code de parrainage") : ""],
        cta: { label: "Voir mon portefeuille", url: appUrl("/portefeuille", ctx.locale) },
      };
    }

    // --------------------------------------------------------------- Support
    case "TICKET_REPLY": {
      const subject = str(payload, "subject");
      const preview = str(payload, "preview");
      return {
        subject: subject ? `Réponse du support — ${subject}` : "Réponse à ton ticket de support",
        eyebrow: "Support",
        title: "Le support t'a répondu",
        body: [
          `Une réponse vient d'être publiée sur ton ticket${subject ? ` ${b(subject)}` : ""}.`,
        ],
        blocks: [preview ? blockQuote(preview.slice(0, 220), "Équipe The Park") : ""],
        cta: { label: "Lire la réponse", url: actionUrl(type, ctx, "/support") },
      };
    }

    default:
      return null;
  }
}

/** Boutique officielle : confirmation, préparation, expédition, suivi, annulation, remboursement. */
function shopOrderSpec(payload: Payload, ctx: NotificationEmailContext): TemplateSpec {
  const status = str(payload, "status") ?? "";
  const num = str(payload, "orderNumber");
  const tracking = str(payload, "trackingNumber");
  const carrier = str(payload, "shippingMethod");
  const total = money(payload.total);
  const numLabel = num ? ` n°${num}` : "";
  const url = actionUrl("ORDER_UPDATE", ctx, "/dashboard");

  const recap = blockData([
    { label: "Commande", value: num ? esc(num) : "—" },
    { label: "Transporteur", value: carrier ? esc(carrier) : "" },
    { label: "Total", value: total ? esc(total) : "", tone: "gold" },
  ]);

  // Suivi ajouté sans changement de statut → e-mail dédié.
  if (payload.trackingAdded === true && tracking) {
    return {
      subject: `Ton numéro de suivi — commande${numLabel}`,
      eyebrow: "Boutique",
      title: "Ton colis est traçable",
      tone: "success",
      body: [`Ta commande${num ? ` ${b(num)}` : ""} dispose d'un numéro de suivi. Tu peux suivre son acheminement dès maintenant.`],
      blocks: [blockCode(tracking, carrier ? `Suivi ${carrier}` : "Numéro de suivi"), recap],
      cta: { label: "Suivre ma commande", url },
    };
  }

  switch (status) {
    case "PREPARING":
      return {
        subject: `Commande${numLabel} en préparation`,
        eyebrow: "Boutique",
        title: "On prépare ton colis",
        body: [
          `Ta commande${num ? ` ${b(num)}` : ""} est en cours de préparation dans notre atelier. Tu recevras le numéro de suivi dès le dépôt.`,
        ],
        blocks: [recap],
        cta: { label: "Voir ma commande", url },
      };
    case "SHIPPED":
      return {
        subject: `Commande${numLabel} expédiée 📦`,
        eyebrow: "Boutique",
        title: "Ton colis est parti",
        tone: "success",
        body: [`Ta commande${num ? ` ${b(num)}` : ""} vient d'être remise au transporteur${carrier ? ` (${b(carrier)})` : ""}.`],
        blocks: [tracking ? blockCode(tracking, carrier ? `Suivi ${carrier}` : "Numéro de suivi") : "", recap],
        cta: { label: "Suivre ma commande", url },
        footerNote: "Le suivi peut mettre quelques heures avant d'être actif chez le transporteur.",
      };
    case "DELIVERED":
      return {
        subject: `Commande${numLabel} livrée`,
        eyebrow: "Boutique",
        title: "Ton colis est arrivé",
        tone: "success",
        body: [
          `Ta commande${num ? ` ${b(num)}` : ""} a été livrée. Ouvre les boosters, scanne tes cartes et remplis ta collection.`,
        ],
        blocks: [recap],
        cta: { label: "Ajouter mes cartes", url: appUrl("/collection", ctx.locale) },
        footerNote: "Un souci avec ta commande ? Réponds à cet e-mail ou passe par le support sous 14 jours.",
      };
    case "CANCELLED":
      return {
        subject: `Commande${numLabel} annulée`,
        eyebrow: "Boutique",
        title: "Ta commande a été annulée",
        tone: "danger",
        body: [
          `Ta commande${num ? ` ${b(num)}` : ""} a été annulée. Si un paiement avait été encaissé, il est remboursé automatiquement sous 5 à 10 jours ouvrés.`,
        ],
        blocks: [recap],
        cta: { label: "Contacter le support", url: appUrl("/support", ctx.locale) },
      };
    case "REFUNDED":
      return {
        subject: `Commande${numLabel} remboursée`,
        eyebrow: "Boutique",
        title: "Ton remboursement est parti",
        tone: "gold",
        body: [
          `Le remboursement de ta commande${num ? ` ${b(num)}` : ""} a été émis vers ton moyen de paiement d'origine.`,
        ],
        blocks: [total ? blockAmount(total, "Montant remboursé") : "", recap],
        cta: { label: "Voir ma commande", url },
        footerNote: "Le délai d'apparition sur ton relevé dépend de ta banque (5 à 10 jours ouvrés).",
      };
    default:
      return {
        subject: `Mise à jour de ta commande${numLabel}`,
        eyebrow: "Boutique",
        title: "Ta commande a été mise à jour",
        body: [`Le statut de ta commande${num ? ` ${b(num)}` : ""} vient de changer.`],
        blocks: [tracking ? blockCode(tracking, "Numéro de suivi") : "", recap],
        cta: { label: "Voir ma commande", url },
      };
  }
}
