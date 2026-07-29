import "server-only";
import { prisma } from "@/lib/prisma";
import { roundEur } from "@/lib/wallet";
import { debitWalletForSale } from "@/server/wallet/wallet.service";
import { markSalePaid } from "@/server/sale/sale-lifecycle.service";
import { transferOwnedCopies } from "@/server/collection/collection.mutations";

/**
 * Règlement d'une enchère remportée.
 *
 * Jusqu'ici `settleDueAuctions` désignait un gagnant et s'arrêtait là : ni vente,
 * ni encaissement, ni transfert de carte — le trou métier que documentait le test
 * « après settleDueAuctions en SOLD, AUCUN Payment ni Sale n'est créé ».
 *
 * On comble ce trou en réutilisant le cycle de vie marketplace plutôt qu'en le
 * dupliquant : la clôture crée une annonce de règlement (statut SOLD, non listée
 * publiquement puisqu'elle naît déjà vendue) puis une `Sale` classique. Expédition,
 * garantie, litige, avis et versement vendeur fonctionnent alors sans modification.
 */

/** Commission plateforme prélevée sur une vente aux enchères. */
export const AUCTION_SERVICE_FEE_PCT = 0.05;

/** Commission due sur un prix d'adjudication, arrondie au centime. */
export function auctionServiceFee(priceEur: number): number {
  return roundEur(priceEur * AUCTION_SERVICE_FEE_PCT);
}

/**
 * Crée la vente correspondant à une enchère adjugée, débite le gagnant et laisse
 * le cycle de vie marketplace prendre le relais.
 *
 * Idempotent : `Sale.auctionId` est unique, un second appel renvoie la vente
 * existante sans rien refacturer. Appelé par `settleDueAuctions`, donc susceptible
 * de rejouer à chaque passage du cron.
 *
 * @returns l'id de la vente, ou `null` si l'enchère n'est pas adjugée.
 */
export async function settleAuctionSale(auctionId: string): Promise<string | null> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      sellerId: true,
      winnerId: true,
      variantId: true,
      condition: true,
      currentPrice: true,
      status: true,
      sale: { select: { id: true } },
    },
  });
  if (!auction) throw new Error("AUCTION_NOT_FOUND");
  if (auction.sale) return auction.sale.id;
  if (auction.status !== "SOLD" || !auction.winnerId) return null;

  const price = roundEur(Number(auction.currentPrice));
  const serviceFee = auctionServiceFee(price);
  const winnerId = auction.winnerId;

  // Le gagnant a forcément une inscription : `placeBid` la rend obligatoire. On
  // retombe sur la remise en main propre plutôt que d'échouer, pour ne pas bloquer
  // le règlement d'une enchère antérieure à cette règle.
  const registration = await prisma.auctionRegistration.findUnique({
    where: { auctionId_userId: { auctionId: auction.id, userId: winnerId } },
    include: { address: true },
  });
  const shippingMode = registration?.shippingMode ?? "HAND_DELIVERY";
  const shippingCost = roundEur(Number(registration?.shippingCost ?? 0));

  // Snapshot immuable : l'adresse est figée à l'adjudication, une correction
  // ultérieure du carnet d'adresses ne doit pas réécrire une vente conclue.
  /** Ce que le gagnant débourse réellement : adjudication + port. */
  const total = roundEur(price + shippingCost);

  const a = registration?.address;
  const deliveryAddress = a
    ? {
        fullName: a.fullName,
        line1: a.line1,
        line2: a.line2,
        zip: a.zip,
        city: a.city,
        country: a.country,
        phone: a.phone,
      }
    : undefined;

  const saleId = await prisma.$transaction(async (tx) => {
    // Annonce de règlement : elle naît vendue, donc n'apparaît jamais au catalogue.
    // Elle sert de support à la vente, comme pour un achat marketplace.
    const listing = await tx.listing.create({
      data: {
        sellerId: auction.sellerId,
        variantId: auction.variantId,
        type: "SELL",
        status: "SOLD",
        price,
        condition: auction.condition,
        quantity: 1,
      },
    });

    const sale = await tx.sale.create({
      data: {
        listingId: listing.id,
        auctionId: auction.id,
        buyerId: winnerId,
        sellerId: auction.sellerId,
        status: "PENDING_PAYMENT",
        price,
        // La commission est portée par la vente ET par le paiement : c'est
        // `Payment.applicationFee` que `releaseToSeller` déduit du versement.
        serviceFee,
        shippingMode,
        shippingCost,
        deliveryAddress,
      },
    });

    await tx.payment.create({
      data: {
        userId: winnerId,
        payeeId: auction.sellerId,
        kind: "PURCHASE",
        status: "REQUIRES_PAYMENT",
        // L'acheteur règle l'adjudication et le port. La commission n'est pas
        // ajoutée par-dessus : elle est retenue sur le versement au vendeur, que
        // `releaseToSeller` calcule en `amount - applicationFee`.
        amount: total,
        applicationFee: serviceFee,
        saleId: sale.id,
        auctionId: auction.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Transfert de propriété : le vendeur perd l'exemplaire, le gagnant l'obtient.
    // Fait ici, dans la même transaction que la vente, pour qu'une carte ne puisse
    // jamais être adjugée sans changer de mains. `transferOwnedCopies` consomme la
    // réservation posée à la création de l'enchère.
    await transferOwnedCopies(tx, {
      fromUserId: auction.sellerId,
      toUserId: winnerId,
      variantId: auction.variantId,
      condition: auction.condition,
    });

    // La ligne du vendeur peut retomber à zéro : elle ne doit plus s'afficher
    // comme « à vendre » dans son classeur.
    await tx.collectionItem.updateMany({
      where: { userId: auction.sellerId, variantId: auction.variantId, quantity: { lte: 0 } },
      data: { forSale: false },
    });

    await tx.transactionEvent.create({
      data: {
        entityType: "SALE",
        entityId: sale.id,
        toStatus: "PENDING_PAYMENT",
        event: "SALE_CREATED",
        metadata: { auctionId: auction.id, listingId: listing.id, serviceFee },
      },
    });

    return sale.id;
  });

  // Le gagnant est solvable par construction : `placeBid` refuse toute mise (et tout
  // plafond d'enchère auto) que le portefeuille ne couvre pas. Le solde peut malgré
  // tout avoir fondu entre-temps — on laisse alors remonter INSUFFICIENT_CREDIT, la
  // vente reste en PENDING_PAYMENT et le prochain passage du cron réessaiera.
  await debitWalletForSale({ userId: winnerId, saleId, amountEur: total });
  await markSalePaid(saleId);

  return saleId;
}
