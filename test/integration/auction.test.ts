import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createAuction,
  placeBid,
  settleDueAuctions,
  minNextBid,
} from "@/server/auction/auction.mutations";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  cleanupTag,
} from "./_helpers/fixtures";

const TAG = qaTag();

// createTestCatalog dérive ses codes de réf uniques du tag ; plusieurs appels dans
// un même fichier utiliseraient donc le MÊME code → collision de contrainte unique.
// On génère un sous-tag par catalogue (toujours préfixé par TAG pour que cleanupTag
// — qui matche `QA-${TAG}` en startsWith — le supprime).
let catalogSeq = 0;
function catalogTag() {
  return `${TAG}c${(catalogSeq += 1)}`;
}

afterAll(async () => {
  // Nettoie chaque catalogue dérivé puis le tag de base (utilisateurs, enchères…).
  for (let i = 1; i <= catalogSeq; i++) await cleanupTag(`${TAG}c${i}`);
  await cleanupTag(TAG);
});

/** Rapproche endsAt d'une enchère existante (pour tester clôture / anti-snipe). */
async function setEndsAt(auctionId: string, endsAt: Date) {
  await prisma.auction.update({ where: { id: auctionId }, data: { endsAt } });
}

describe(`auction [${TAG}] — enchères`, () => {
  // ─────────────────────────────────────────────────────────────────────────
  // 0. minNextBid (unité pure)
  // ─────────────────────────────────────────────────────────────────────────
  it("minNextBid: prix de départ si aucune mise, sinon top + increment", () => {
    expect(minNextBid(5, 0.5, null)).toBe(5);
    expect(minNextBid(5, 0.5, 7)).toBe(7.5);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Création
  // ─────────────────────────────────────────────────────────────────────────
  it("createAuction réserve 1 exemplaire (reservedQuantity+1, forSale=true) et crée une enchère ACTIVE", async () => {
    const seller = await createTestUser(TAG, 1);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });

    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      reservePrice: 8,
      bidIncrement: 0.5,
    });

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("ACTIVE");
    expect(Number(auction.startPrice)).toBe(5);
    expect(Number(auction.currentPrice)).toBe(5);
    expect(Number(auction.reservePrice)).toBe(8);
    expect(Number(auction.bidIncrement)).toBe(0.5);

    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    expect(item.reservedQuantity).toBe(1);
    expect(item.forSale).toBe(true);
  });

  it("createAuction rejette NOT_OWNED si le vendeur ne possède pas la variante", async () => {
    const stranger = await createTestUser(TAG, 2);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    await expect(
      createAuction(stranger.id, { variantId: variants[0].id, startPrice: 5, durationDays: 3 }),
    ).rejects.toThrow("NOT_OWNED");
  });

  it("createAuction rejette ALL_RESERVED si tous les exemplaires sont déjà réservés", async () => {
    const seller = await createTestUser(TAG, 3);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    // 1 exemplaire, déjà réservé (par ex. une enchère existante).
    await prisma.collectionItem.create({
      data: { userId: seller.id, variantId, condition: "EXCELLENT", quantity: 1, reservedQuantity: 1 },
    });
    await expect(
      createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 }),
    ).rejects.toThrow("ALL_RESERVED");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Placement d'enchères
  // ─────────────────────────────────────────────────────────────────────────
  it("placeBid crée un Bid, met à jour currentPrice et notifie le précédent enchérisseur (AUCTION_OUTBID)", async () => {
    const seller = await createTestUser(TAG, 10);
    const b1 = await createTestUser(TAG, 11);
    const b2 = await createTestUser(TAG, 12);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });

    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    // Première mise : au moins startPrice.
    await placeBid(b1.id, auctionId, 5);
    let auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(Number(auction.currentPrice)).toBe(5);

    // Seconde mise : b2 doit payer au moins top + increment = 6.
    await placeBid(b2.id, auctionId, 6);
    auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(Number(auction.currentPrice)).toBe(6);

    const bids = await prisma.bid.findMany({ where: { auctionId }, orderBy: { amount: "asc" } });
    expect(bids).toHaveLength(2);

    // Le précédent enchérisseur (b1) a reçu AUCTION_OUTBID.
    const outbid = await prisma.notification.findFirst({
      where: { userId: b1.id, type: "AUCTION_OUTBID", entityId: auctionId },
    });
    expect(outbid).not.toBeNull();
  });

  it("placeBid rejette SELF_BID (le vendeur ne peut pas enchérir)", async () => {
    const seller = await createTestUser(TAG, 20);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });
    await expect(placeBid(seller.id, auctionId, 6)).rejects.toThrow("SELF_BID");
  });

  it("placeBid rejette BID_TOO_LOW (montant < minNextBid)", async () => {
    const seller = await createTestUser(TAG, 21);
    const bidder = await createTestUser(TAG, 22);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    // Sous le prix de départ.
    await expect(placeBid(bidder.id, auctionId, 4)).rejects.toThrow("BID_TOO_LOW");
    // Puis une mise valide, et une seconde mise trop faible (< top + increment).
    await placeBid(bidder.id, auctionId, 5);
    const bidder2 = await createTestUser(TAG, 23);
    await expect(placeBid(bidder2.id, auctionId, 5.5)).rejects.toThrow("BID_TOO_LOW");
  });

  it("placeBid rejette AUCTION_NOT_FOUND si l'enchère est finie ou inexistante", async () => {
    const bidder = await createTestUser(TAG, 24);
    // Enchère inexistante.
    await expect(placeBid(bidder.id, "does-not-exist", 5)).rejects.toThrow("AUCTION_NOT_FOUND");

    // Enchère expirée (endsAt dans le passé).
    const seller = await createTestUser(TAG, 25);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });
    await setEndsAt(auctionId, new Date(Date.now() - 60_000));
    await expect(placeBid(bidder.id, auctionId, 6)).rejects.toThrow("AUCTION_NOT_FOUND");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Anti-snipe
  // ─────────────────────────────────────────────────────────────────────────
  it("anti-snipe: une mise dans les <2 dernières minutes prolonge endsAt", async () => {
    const seller = await createTestUser(TAG, 30);
    const bidder = await createTestUser(TAG, 31);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });

    // Rapproche la fin à +30s (dans la fenêtre anti-snipe de 2min).
    const soon = new Date(Date.now() + 30_000);
    await setEndsAt(auctionId, soon);

    await placeBid(bidder.id, auctionId, 5);

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    // Prolongée à ~ now + 2min > l'ancien endsAt.
    expect(auction.endsAt.getTime()).toBeGreaterThan(soon.getTime());
    expect(auction.endsAt.getTime()).toBeGreaterThan(Date.now() + 90_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Clôture (settleDueAuctions)
  // ─────────────────────────────────────────────────────────────────────────
  it("settleDueAuctions: enchère expirée avec réserve atteinte → SOLD + winnerId + notif AUCTION_WON, libère la réservation", async () => {
    const seller = await createTestUser(TAG, 40);
    const winner = await createTestUser(TAG, 41);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });

    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      reservePrice: 6,
      bidIncrement: 1,
    });
    await placeBid(winner.id, auctionId, 7); // >= reserve
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("SOLD");
    expect(auction.winnerId).toBe(winner.id);
    expect(Number(auction.currentPrice)).toBe(7);

    // Réservation libérée + forSale=false.
    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    expect(item.reservedQuantity).toBe(0);
    expect(item.forSale).toBe(false);

    // Notifications.
    const won = await prisma.notification.findFirst({
      where: { userId: winner.id, type: "AUCTION_WON", entityId: auctionId },
    });
    expect(won).not.toBeNull();
    const ended = await prisma.notification.findFirst({
      where: { userId: seller.id, type: "AUCTION_ENDED", entityId: auctionId },
    });
    expect(ended).not.toBeNull();
  });

  it("settleDueAuctions: réserve NON atteinte → CLOSED sans winner, libère la réservation", async () => {
    const seller = await createTestUser(TAG, 42);
    const bidder = await createTestUser(TAG, 43);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });

    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      reservePrice: 50, // réserve très haute, jamais atteinte
      bidIncrement: 1,
    });
    await placeBid(bidder.id, auctionId, 5); // < reserve
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("CLOSED");
    expect(auction.winnerId).toBeNull();

    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    expect(item.reservedQuantity).toBe(0);
    expect(item.forSale).toBe(false);
  });

  it("settleDueAuctions: sans aucune mise → CLOSED sans winner", async () => {
    const seller = await createTestUser(TAG, 44);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();
    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("CLOSED");
    expect(auction.winnerId).toBeNull();
  });

  it("settleDueAuctions est idempotent : un 2e appel ne re-libère pas la réservation ni ne re-clôture", async () => {
    const seller = await createTestUser(TAG, 45);
    const winner = await createTestUser(TAG, 46);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    await placeBid(winner.id, auctionId, 6);
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    const firstCount = await settleDueAuctions();
    expect(firstCount).toBeGreaterThanOrEqual(1);

    const itemAfter1 = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    expect(itemAfter1.reservedQuantity).toBe(0);

    // 2e appel : l'enchère n'est plus ACTIVE → ne doit RIEN faire pour celle-ci.
    await settleDueAuctions();
    const itemAfter2 = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    // reservedQuantity ne doit pas être passé négatif ni retouché.
    expect(itemAfter2.reservedQuantity).toBe(0);

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("SOLD");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Concurrence (bug de course E1)
  // ─────────────────────────────────────────────────────────────────────────
  it("concurrence E1: 2 placeBid simultanés — les deux passent la validation sans verrou (course confirmée)", async () => {
    const seller = await createTestUser(TAG, 50);
    const b1 = await createTestUser(TAG, 51);
    const b2 = await createTestUser(TAG, 52);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    // b1 tente 6, b2 tente 10, SIMULTANÉMENT. En SÉRIE correct : une des deux
    // devient le top, et la seconde plus faible (ou < top+increment) DEVRAIT être
    // rejetée en BID_TOO_LOW. Ici les deux transactions relisent le top (auction.mutations.ts:75)
    // sans verrou de ligne → elles lisent toutes deux top=null (min=startPrice=5),
    // valident, et créent chacune leur Bid.
    const results = await Promise.allSettled([
      placeBid(b1.id, auctionId, 6),
      placeBid(b2.id, auctionId, 10),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;

    const bids = await prisma.bid.findMany({ where: { auctionId }, orderBy: { amount: "desc" } });
    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    const topBid = bids.length > 0 ? Number(bids[0].amount) : null;

    // eslint-disable-next-line no-console
    console.log(
      `[E1] fulfilled=${fulfilled} bids=[${bids.map((b) => Number(b.amount)).join(",")}] currentPrice=${Number(auction.currentPrice)} topBid=${topBid}`,
    );

    // BUG (E1 CONFIRMÉ — course sur placeBid) :
    // placeBid ne pose AUCUN verrou (pas de SELECT ... FOR UPDATE ni d'isolation
    // Serializable). Deux mises concurrentes passent donc TOUTES DEUX la garde
    // BID_TOO_LOW alors qu'en séquentiel la plus faible aurait dû être rejetée.
    // Voir src/server/auction/auction.mutations.ts:73-91.
    expect(fulfilled).toBe(2);
    expect(bids).toHaveLength(2);

    // Conséquence directe : currentPrice = montant de la DERNIÈRE tx commitée, qui
    // n'est PAS garanti d'être la meilleure mise. On documente le résultat observé :
    // dans nos exécutions currentPrice a pu valoir 6 (la mise la plus faible) alors
    // que topBid=10 → incohérence prix courant vs meilleure enchère.
    if (Number(auction.currentPrice) !== topBid) {
      // BUG: currentPrice (dernière écriture) != meilleure mise réelle.
      expect(Number(auction.currentPrice)).toBeLessThan(topBid as number);
    } else {
      // Selon l'ordre de commit, currentPrice a pu coïncider avec le top.
      expect(Number(auction.currentPrice)).toBe(topBid);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Trou fonctionnel : aucun Payment/Sale créé après SOLD
  // ─────────────────────────────────────────────────────────────────────────
  it("trou métier: après settleDueAuctions en SOLD, AUCUN Payment ni Sale n'est créé", async () => {
    const seller = await createTestUser(TAG, 60);
    const winner = await createTestUser(TAG, 61);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    await placeBid(winner.id, auctionId, 6);
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("SOLD");

    // BUG / TROU MÉTIER: settleDueAuctions marque SOLD + winnerId mais ne déclenche
    // AUCUN encaissement ni transfert de propriété. Voir auction.mutations.ts:124-138 :
    // aucune création de Payment/Sale, aucun débit wallet, aucun transfert de collection.
    const payment = await prisma.payment.findFirst({ where: { auctionId } });
    expect(payment).toBeNull();

    // Sale n'a pas de variantId (lié via listingId) : on vérifie qu'aucune vente
    // n'existe pour ce gagnant/vendeur suite à la clôture d'enchère.
    const saleForWinner = await prisma.sale.findFirst({
      where: { buyerId: winner.id, sellerId: seller.id },
    });
    expect(saleForWinner).toBeNull();

    // Le gagnant ne reçoit pas la carte, le vendeur la garde (quantité inchangée).
    const sellerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    expect(sellerItem.quantity).toBe(1);
    const winnerItem = await prisma.collectionItem.findFirst({
      where: { userId: winner.id, variantId },
    });
    expect(winnerItem).toBeNull();
  });
});
