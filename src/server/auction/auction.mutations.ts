import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, ShippingMode } from "@/generated/prisma/client";
import { isHandDelivery, isSelectableShippingMode, shippingFeeEur } from "@/lib/shipping";
import { formatPrice } from "@/lib/format";
import { dispatchNotification } from "@/server/notification/notification.mutations";
import { evaluateUserBadgesSafe } from "@/server/badge/badge.service";
import { debitWalletForAuctionOption } from "@/server/wallet/wallet.service";
import { settleAuctionSale } from "@/server/auction/auction-settlement.service";

// Anti-snipe : une enchère placée dans les dernières minutes prolonge la vente.
const ANTI_SNIPE_WINDOW_MS = 2 * 60 * 1000;
const ANTI_SNIPE_EXTENSION_MS = 2 * 60 * 1000;

/** Tarif de l'option « enchère automatique », à l'acte et par enchère. */
export const AUTO_BID_OPTION_FEE_EUR = 5;

/** Mise minimale acceptée : prix de départ pour la 1ʳᵉ enchère, sinon meilleure mise + pas. */
export function minNextBid(startPrice: number, increment: number, topBid: number | null): number {
  return topBid == null ? startPrice : topBid + increment;
}

export interface ProxyDuel {
  /** Montant inscrit au nom du challenger. */
  challengerAmount: number;
  /** Contre-mise automatique du leader en place, `null` s'il n'en a pas besoin. */
  incumbentAutoAmount: number | null;
  /** Qui mène à l'issue du duel. */
  leader: "challenger" | "incumbent";
  /** Nouveau prix courant de l'enchère. */
  leadPrice: number;
}

/**
 * Départage une nouvelle mise et le plafond du leader en place (proxy bidding).
 *
 * Règle, calquée sur les places de marché classiques : celui qui a le plafond le
 * plus haut mène, au minimum nécessaire pour passer devant l'autre — jamais à son
 * propre plafond s'il n'y est pas contraint. Le perdant voit sa mise inscrite à son
 * plafond : il l'a réellement engagé.
 *
 * `incumbentMax` est le plafond du leader **déjà ramené à ce que son portefeuille
 * couvre** : un leader insolvable au-delà de sa mise courante ne peut pas remonter.
 * À égalité de plafond, l'antériorité l'emporte — sinon un arrivant tardif volerait
 * la tête sans payer davantage.
 *
 * Fonction pure : toute l'arithmétique du duel est testable sans base.
 */
export function resolveProxyDuel(input: {
  increment: number;
  /** Montant saisi par le challenger (déjà validé >= minNextBid). */
  challengerBid: number;
  /** Plafond du challenger (== challengerBid s'il n'utilise pas l'enchère auto). */
  challengerMax: number;
  /** Plafond effectif du leader en place, `null` s'il n'y a pas encore de mise. */
  incumbentMax: number | null;
}): ProxyDuel {
  const { increment, challengerBid, challengerMax, incumbentMax } = input;

  // Personne à battre : le challenger mène au montant qu'il a saisi, pas à son plafond.
  if (incumbentMax == null) {
    return {
      challengerAmount: challengerBid,
      incumbentAutoAmount: null,
      leader: "challenger",
      leadPrice: challengerBid,
    };
  }

  if (challengerMax > incumbentMax) {
    // Le challenger passe devant, au minimum nécessaire — et jamais sous sa saisie.
    const price = round2(
      Math.max(challengerBid, Math.min(challengerMax, incumbentMax + increment)),
    );
    return {
      challengerAmount: price,
      // Le leader déchu est monté jusqu'à son plafond en tentant de résister.
      incumbentAutoAmount: incumbentMax,
      leader: "challenger",
      leadPrice: price,
    };
  }

  // Le leader tient : il ne remonte qu'au strict nécessaire, plafonné à son maximum.
  const hold = round2(Math.min(incumbentMax, challengerMax + increment));
  return {
    challengerAmount: challengerMax,
    incumbentAutoAmount: hold,
    leader: "incumbent",
    leadPrice: hold,
  };
}

/** Les montants sont des Decimal(10,2) : on évite les traînées de flottant. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Crée une vente aux enchères sur une variante possédée (réserve l'exemplaire). */
export async function createAuction(
  sellerId: string,
  input: {
    variantId: string;
    startPrice: number;
    durationDays: number;
    reservePrice?: number;
    bidIncrement?: number;
  },
): Promise<string> {
  const item = await prisma.collectionItem.findFirst({
    where: { userId: sellerId, variantId: input.variantId, quantity: { gt: 0 } },
    select: { id: true, quantity: true, reservedQuantity: true, condition: true },
  });
  if (!item) throw new Error("NOT_OWNED");
  if (item.reservedQuantity >= item.quantity) throw new Error("ALL_RESERVED");

  const now = Date.now();
  const endsAt = new Date(now + input.durationDays * 24 * 60 * 60 * 1000);

  const auction = await prisma.$transaction(async (tx) => {
    await tx.collectionItem.update({
      where: { id: item.id },
      data: { reservedQuantity: { increment: 1 }, forSale: true },
    });
    return tx.auction.create({
      data: {
        sellerId,
        variantId: input.variantId,
        condition: item.condition,
        startPrice: input.startPrice,
        reservePrice: input.reservePrice ?? null,
        currentPrice: input.startPrice,
        bidIncrement: input.bidIncrement ?? 0.1,
        status: "ACTIVE",
        startsAt: new Date(now),
        endsAt,
      },
    });
  });

  return auction.id;
}

export interface AuctionRegistrationInput {
  /** Adresse de livraison du membre. Null uniquement pour une remise en main propre. */
  addressId?: string | null;
  shippingMode: ShippingMode;
}

/**
 * Inscrit un membre à une enchère : il déclare où et comment il se ferait livrer
 * s'il l'emporte. Cette déclaration conditionne le droit de miser — sans elle,
 * l'adjudication produirait une vente sans adresse, à réclamer après coup.
 *
 * Ré-appelable tant que l'enchère court : le membre peut corriger son adresse ou
 * changer de mode d'envoi. Les frais sont refigés à chaque modification.
 */
export async function registerForAuction(
  userId: string,
  auctionId: string,
  input: AuctionRegistrationInput,
): Promise<void> {
  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, status: "ACTIVE", endsAt: { gt: new Date() } },
    select: { sellerId: true },
  });
  if (!auction) throw new Error("AUCTION_NOT_FOUND");
  if (auction.sellerId === userId) throw new Error("SELF_BID");

  if (!isSelectableShippingMode(input.shippingMode)) throw new Error("SHIPPING_MODE_INVALID");

  // La remise en main propre est le seul mode sans adresse : partout ailleurs, le
  // vendeur doit savoir où expédier avant que la mise engage l'acheteur.
  const addressId = input.addressId ?? null;
  if (isHandDelivery(input.shippingMode)) {
    if (addressId) throw new Error("ADDRESS_NOT_ALLOWED");
  } else {
    if (!addressId) throw new Error("ADDRESS_REQUIRED");
    const owned = await prisma.address.findFirst({
      where: { id: addressId, userId },
      select: { id: true },
    });
    if (!owned) throw new Error("ADDRESS_NOT_FOUND");
  }

  const shippingCost = shippingFeeEur(input.shippingMode);

  await prisma.auctionRegistration.upsert({
    where: { auctionId_userId: { auctionId, userId } },
    create: { auctionId, userId, addressId, shippingMode: input.shippingMode, shippingCost },
    update: { addressId, shippingMode: input.shippingMode, shippingCost },
  });
}

export interface AuctionRegistrationView {
  addressId: string | null;
  shippingMode: ShippingMode;
  shippingCostEur: number;
}

/** Inscription d'un membre à une enchère, `null` s'il ne s'est pas encore inscrit. */
export async function getAuctionRegistration(
  userId: string,
  auctionId: string,
): Promise<AuctionRegistrationView | null> {
  const row = await prisma.auctionRegistration.findUnique({
    where: { auctionId_userId: { auctionId, userId } },
    select: { addressId: true, shippingMode: true, shippingCost: true },
  });
  if (!row) return null;
  return {
    addressId: row.addressId,
    shippingMode: row.shippingMode,
    shippingCostEur: Number(row.shippingCost),
  };
}

/**
 * Achète l'option « enchère automatique » sur une enchère, pour le compte du membre.
 * Idempotent : si l'option est déjà détenue, on ne refacture pas.
 *
 * @returns `true` si l'option vient d'être achetée, `false` si elle l'était déjà.
 */
export async function purchaseAutoBidOption(userId: string, auctionId: string): Promise<boolean> {
  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, status: "ACTIVE", endsAt: { gt: new Date() } },
    select: { sellerId: true },
  });
  if (!auction) throw new Error("AUCTION_NOT_FOUND");
  if (auction.sellerId === userId) throw new Error("SELF_BID");

  const existing = await prisma.auctionAutoBidOption.findUnique({
    where: { auctionId_userId: { auctionId, userId } },
    select: { id: true },
  });
  if (existing) return false;

  // Débit d'abord : si le portefeuille ne suit pas, aucune option n'est créée.
  await debitWalletForAuctionOption({ userId, auctionId, amountEur: AUTO_BID_OPTION_FEE_EUR });

  try {
    await prisma.auctionAutoBidOption.create({
      data: { auctionId, userId, feePaid: AUTO_BID_OPTION_FEE_EUR },
    });
  } catch (err) {
    // Course sur le double clic : le débit est idempotent, l'option existe déjà.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") return false;
    throw err;
  }
  return true;
}

/** L'option payante est-elle détenue par ce membre sur cette enchère ? */
export async function hasAutoBidOption(userId: string, auctionId: string): Promise<boolean> {
  const option = await prisma.auctionAutoBidOption.findUnique({
    where: { auctionId_userId: { auctionId, userId } },
    select: { id: true },
  });
  return option != null;
}

/** Solde dépensable (dépôt + gains) d'un membre, lu dans la transaction en cours. */
async function spendableBalance(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const wallet = await tx.walletAccount.findUnique({
    where: { userId },
    select: { depositBalance: true, earnedBalance: true },
  });
  return wallet ? Number(wallet.depositBalance) + Number(wallet.earnedBalance) : 0;
}

export interface PlaceBidOptions {
  /**
   * Plafond d'enchère automatique. Le système ne mise que le minimum nécessaire et
   * remonte tout seul jusqu'à ce montant. Requiert l'option payante sur l'enchère
   * (cf. `assertAutoBidUnlocked`) — non vérifiée ici, la garde est dans l'action.
   */
  maxAmount?: number;
}

/**
 * Place une enchère sur une vente active, en résolvant le duel de plafonds si le
 * leader en place dispose d'une enchère automatique.
 *
 * @returns l'id de la mise inscrite au nom de `bidderId`.
 */
export async function placeBid(
  bidderId: string,
  auctionId: string,
  amount: number,
  options: PlaceBidOptions = {},
): Promise<string> {
  const card = await prisma.auction.findUnique({
    where: { id: auctionId },
    // Nom + visuel de la carte : alimentent la notification et l'e-mail.
    select: { variant: { select: { imageUrl: true, card: { select: { name: true } } } } },
  });
  if (!card) throw new Error("AUCTION_NOT_FOUND");

  const outcome = await prisma.$transaction(async (tx) => {
    // Verrou de ligne sur l'enchère : sérialise les mises concurrentes sur la même
    // vente. Sans lui, deux placeBid simultanés relisent le même top, passent tous
    // deux la garde BID_TOO_LOW et `currentPrice` peut finir sous la meilleure mise
    // (course documentée par le test « concurrence E1 »). Le verrou est relâché au
    // commit ; les mises sur des enchères différentes ne se bloquent pas entre elles.
    await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${auctionId} FOR UPDATE`;

    // Relu APRÈS le verrou : statut et échéance peuvent avoir changé pendant l'attente.
    const auction = await tx.auction.findFirst({
      where: { id: auctionId, status: "ACTIVE", endsAt: { gt: new Date() } },
    });
    if (!auction) throw new Error("AUCTION_NOT_FOUND");
    if (auction.sellerId === bidderId) throw new Error("SELF_BID");

    const increment = Number(auction.bidIncrement);
    const top = await tx.bid.findFirst({ where: { auctionId }, orderBy: { amount: "desc" } });
    const topAmount = top ? Number(top.amount) : null;

    const minBid = minNextBid(Number(auction.startPrice), increment, topAmount);
    if (amount < minBid) throw new Error("BID_TOO_LOW");

    const challengerMax = options.maxAmount ?? amount;
    if (challengerMax < amount) throw new Error("MAX_BELOW_BID");

    // L'enchère automatique est une option payante : on la vérifie sous le même
    // verrou que la mise, pour qu'un remboursement concurrent ne puisse pas laisser
    // passer un plafond non couvert.
    if (options.maxAmount != null) {
      const option = await tx.auctionAutoBidOption.findUnique({
        where: { auctionId_userId: { auctionId, userId: bidderId } },
        select: { id: true },
      });
      if (!option) throw new Error("AUTO_BID_NOT_UNLOCKED");
    }

    // On ne mise pas sans avoir dit où se faire livrer : l'adjudication doit pouvoir
    // produire une vente expédiable sans rien réclamer au gagnant après coup.
    const registration = await tx.auctionRegistration.findUnique({
      where: { auctionId_userId: { auctionId, userId: bidderId } },
      select: { shippingCost: true },
    });
    if (!registration) throw new Error("NOT_REGISTERED");

    // Une enchère est un engagement de payer : on refuse ce que le portefeuille ne
    // couvre pas, sinon la vente se clôture sur un gagnant insolvable. AUCUN débit
    // ici — les fonds ne bougent qu'à l'adjudication, et pour le seul gagnant ; les
    // autres participants récupèrent la libre disposition de leur solde.
    // C'est le plafond qui est engagé, pas la mise affichée (sinon l'enchère auto
    // promettrait des montants intenables), frais de port compris puisqu'ils seront
    // dus au même moment.
    const engaged = round2(challengerMax + Number(registration.shippingCost));
    if ((await spendableBalance(tx, bidderId)) < engaged) throw new Error("INSUFFICIENT_WALLET");

    // Le leader en place ne peut se défendre que jusqu'à ce que son solde couvre.
    let incumbentMax: number | null = null;
    if (top && top.bidderId !== bidderId) {
      const declared = top.maxAmount != null ? Number(top.maxAmount) : Number(top.amount);
      const affordable = await spendableBalance(tx, top.bidderId);
      incumbentMax = Math.max(Number(top.amount), Math.min(declared, affordable));
    }

    const duel = resolveProxyDuel({
      increment,
      challengerBid: amount,
      challengerMax,
      incumbentMax,
    });

    const created = await tx.bid.create({
      data: {
        auctionId,
        bidderId,
        amount: duel.challengerAmount,
        maxAmount: options.maxAmount ?? null,
        isAuto: false,
      },
    });

    // Contre-mise du leader en place : tracée comme une mise à part entière, sinon
    // l'historique afficherait un saut de prix sans auteur.
    if (top && duel.incumbentAutoAmount != null && duel.incumbentAutoAmount > Number(top.amount)) {
      await tx.bid.create({
        data: {
          auctionId,
          bidderId: top.bidderId,
          amount: duel.incumbentAutoAmount,
          maxAmount: top.maxAmount,
          isAuto: true,
        },
      });
    }

    const data: Prisma.AuctionUpdateInput = { currentPrice: duel.leadPrice };
    // Anti-snipe : prolonge la fin si la mise tombe dans la fenêtre finale.
    if (auction.antiSnipe) {
      const remaining = auction.endsAt.getTime() - Date.now();
      if (remaining > 0 && remaining < ANTI_SNIPE_WINDOW_MS) {
        data.endsAt = new Date(Date.now() + ANTI_SNIPE_EXTENSION_MS);
      }
    }
    await tx.auction.update({ where: { id: auctionId }, data });

    // On prévient le perdant du duel : soit le leader déchu, soit le challenger
    // repoussé dans la foulée par l'enchère auto du leader. Personne n'est notifié
    // quand un membre ne fait que surenchérir sur lui-même.
    let outbidUserId: string | undefined;
    let outbidActorId: string | undefined;
    if (duel.leader === "challenger") {
      if (top && top.bidderId !== bidderId) {
        outbidUserId = top.bidderId;
        outbidActorId = bidderId;
      }
    } else if (top) {
      outbidUserId = bidderId;
      outbidActorId = top.bidderId;
    }

    return { bidId: created.id, outbidUserId, outbidActorId, leadPrice: duel.leadPrice };
  });

  if (outcome.outbidUserId) {
    await dispatchNotification({
      userId: outcome.outbidUserId,
      type: "AUCTION_OUTBID",
      actorId: outcome.outbidActorId,
      entityType: "AUCTION",
      entityId: auctionId,
      payload: {
        amount: formatPrice(outcome.leadPrice),
        cardName: card.variant.card.name,
        cardImage: card.variant.imageUrl,
      },
    });
  }

  await evaluateUserBadgesSafe(bidderId);
  return outcome.bidId;
}

/**
 * Clôture les enchères dont le temps est écoulé : statut SOLD (si réserve atteinte)
 * ou CLOSED, désigne le gagnant, libère la réservation du vendeur et notifie.
 * Idempotent — appelé par le cron de maintenance et paresseusement à la lecture.
 */
export async function settleDueAuctions(): Promise<number> {
  const due = await prisma.auction.findMany({
    where: { status: "ACTIVE", endsAt: { lte: new Date() } },
    include: {
      bids: { orderBy: { amount: "desc" }, take: 1 },
      variant: { select: { imageUrl: true, card: { select: { name: true } } } },
    },
  });

  for (const a of due) {
    const top = a.bids[0];
    const reserveMet =
      !a.reservePrice || (top != null && Number(top.amount) >= Number(a.reservePrice));
    const sold = top != null && reserveMet;

    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: a.id },
        data: {
          status: sold ? "SOLD" : "CLOSED",
          winnerId: sold ? top.bidderId : null,
          currentPrice: top ? top.amount : a.currentPrice,
        },
      });
      // La réservation posée à la création n'est relâchée que si la carte reste au
      // vendeur. Sur une vente conclue, c'est le transfert de propriété qui la
      // consomme (`settleAuctionSale`) — la relâcher ici ferait perdre le lien avec
      // l'exemplaire à céder.
      if (!sold) {
        await tx.collectionItem.updateMany({
          where: { userId: a.sellerId, variantId: a.variantId, reservedQuantity: { gt: 0 } },
          data: { reservedQuantity: { decrement: 1 }, forSale: false },
        });
      }
      // Suivi post-enchère : ouvre le fil gagnant ⇄ vendeur pour organiser
      // paiement et livraison (upsert — la clôture peut être appelée en concurrence).
      if (sold) {
        await tx.conversation.upsert({
          where: { auctionId: a.id },
          update: {},
          create: {
            context: "AUCTION",
            auctionId: a.id,
            participants: { create: [{ userId: top.bidderId }, { userId: a.sellerId }] },
          },
        });
      }
    });

    if (sold) {
      // Encaissement + livraison : délégué au cycle de vie marketplace. Une panne
      // ici (solde fondu entre-temps) ne doit pas empêcher la clôture ni les
      // notifications — le prochain passage du cron réessaiera, l'appel est idempotent.
      try {
        await settleAuctionSale(a.id);
      } catch (err) {
        console.error("[auction] règlement impossible", a.id, err);
      }

      await dispatchNotification({
        userId: top.bidderId,
        type: "AUCTION_WON",
        actorId: a.sellerId,
        entityType: "AUCTION",
        entityId: a.id,
        payload: {
          amount: formatPrice(top.amount),
          cardName: a.variant.card.name,
          cardImage: a.variant.imageUrl,
        },
      });
      // Succès liés aux enchères remportées (Sniper de l'Ombre, Flambeur de Tokyo).
      await evaluateUserBadgesSafe(top.bidderId);
    }
    await dispatchNotification({
      userId: a.sellerId,
      type: "AUCTION_ENDED",
      entityType: "AUCTION",
      entityId: a.id,
      payload: {
        amount: top ? formatPrice(top.amount) : formatPrice(a.startPrice),
        sold: String(sold),
        cardName: a.variant.card.name,
        cardImage: a.variant.imageUrl,
      },
    });
  }

  return due.length;
}
