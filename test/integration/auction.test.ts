import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AUTO_BID_OPTION_FEE_EUR,
  createAuction,
  placeBid,
  purchaseAutoBidOption,
  registerForAuction,
  settleDueAuctions,
  minNextBid,
} from "@/server/auction/auction.mutations";
import {
  qaTag,
  createTestUser,
  createTestCatalog,
  addToCollection,
  creditTestWallet,
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

/**
 * Enchérisseur solvable. `placeBid` refuse désormais une mise que le portefeuille
 * ne couvre pas : tout enchérisseur de test doit donc être crédité au préalable.
 */
async function createSolventBidder(tag: string, seq: number, creditEur = 1_000) {
  const user = await createTestUser(tag, seq);
  await creditTestWallet(user.id, creditEur);
  return user;
}

/**
 * Inscrit le participant puis place sa mise.
 *
 * `placeBid` exige désormais une inscription (adresse + mode d'envoi). On passe par
 * la remise en main propre : c'est le seul mode sans adresse et sans frais, donc
 * celui qui laisse les montants des tests inchangés. Les cas qui doivent observer
 * le refus d'inscription appellent `placeBid` directement.
 */
async function bid(
  userId: string,
  auctionId: string,
  amount: number,
  opts?: { maxAmount?: number },
) {
  await registerForAuction(userId, auctionId, { shippingMode: "HAND_DELIVERY" });
  return placeBid(userId, auctionId, amount, opts);
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
      data: {
        userId: seller.id,
        variantId,
        condition: "EXCELLENT",
        quantity: 1,
        reservedQuantity: 1,
      },
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
    const b1 = await createSolventBidder(TAG, 11);
    const b2 = await createSolventBidder(TAG, 12);
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
    await bid(b1.id, auctionId, 5);
    let auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(Number(auction.currentPrice)).toBe(5);

    // Seconde mise : b2 doit payer au moins top + increment = 6.
    await bid(b2.id, auctionId, 6);
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
    await expect(bid(seller.id, auctionId, 6)).rejects.toThrow("SELF_BID");
  });

  it("placeBid rejette BID_TOO_LOW (montant < minNextBid)", async () => {
    const seller = await createTestUser(TAG, 21);
    const bidder = await createSolventBidder(TAG, 22);
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
    await expect(bid(bidder.id, auctionId, 4)).rejects.toThrow("BID_TOO_LOW");
    // Puis une mise valide, et une seconde mise trop faible (< top + increment).
    await bid(bidder.id, auctionId, 5);
    const bidder2 = await createSolventBidder(TAG, 23);
    await expect(bid(bidder2.id, auctionId, 5.5)).rejects.toThrow("BID_TOO_LOW");
  });

  it("placeBid rejette INSUFFICIENT_WALLET si le portefeuille ne couvre pas la mise", async () => {
    const seller = await createTestUser(TAG, 26);
    const fauche = await createTestUser(TAG, 27); // aucun crédit
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    await expect(bid(fauche.id, auctionId, 5)).rejects.toThrow("INSUFFICIENT_WALLET");
    expect(await prisma.bid.count({ where: { auctionId } })).toBe(0);

    // Crédité juste au-dessus de la mise : elle passe.
    await creditTestWallet(fauche.id, 5);
    await bid(fauche.id, auctionId, 5);
    expect(await prisma.bid.count({ where: { auctionId } })).toBe(1);
  });

  it("placeBid rejette AUCTION_NOT_FOUND si l'enchère est finie ou inexistante", async () => {
    const bidder = await createTestUser(TAG, 24);
    // Enchère inexistante.
    await expect(bid(bidder.id, "does-not-exist", 5)).rejects.toThrow("AUCTION_NOT_FOUND");

    // Enchère expirée (endsAt dans le passé).
    const seller = await createTestUser(TAG, 25);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });
    await setEndsAt(auctionId, new Date(Date.now() - 60_000));
    await expect(bid(bidder.id, auctionId, 6)).rejects.toThrow("AUCTION_NOT_FOUND");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Anti-snipe
  // ─────────────────────────────────────────────────────────────────────────
  it("anti-snipe: une mise dans les <2 dernières minutes prolonge endsAt", async () => {
    const seller = await createTestUser(TAG, 30);
    const bidder = await createSolventBidder(TAG, 31);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });

    // Rapproche la fin à +30s (dans la fenêtre anti-snipe de 2min).
    const soon = new Date(Date.now() + 30_000);
    await setEndsAt(auctionId, soon);

    await bid(bidder.id, auctionId, 5);

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
    const winner = await createSolventBidder(TAG, 41);
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
    await bid(winner.id, auctionId, 7); // >= reserve
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
    const bidder = await createSolventBidder(TAG, 43);
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
    await bid(bidder.id, auctionId, 5); // < reserve
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
    const winner = await createSolventBidder(TAG, 46);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    await bid(winner.id, auctionId, 6);
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
  it("concurrence E1: 2 placeBid simultanés sont sérialisés par le verrou de ligne", async () => {
    const seller = await createTestUser(TAG, 50);
    const b1 = await createSolventBidder(TAG, 51);
    const b2 = await createSolventBidder(TAG, 52);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    // b1 tente 6, b2 tente 10, SIMULTANÉMENT. `placeBid` pose désormais un
    // SELECT ... FOR UPDATE sur l'enchère (auction.mutations.ts) : les deux
    // transactions s'exécutent l'une après l'autre sur cette ligne.
    const results = await Promise.allSettled([bid(b1.id, auctionId, 6), bid(b2.id, auctionId, 10)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;

    const bids = await prisma.bid.findMany({ where: { auctionId }, orderBy: { amount: "desc" } });
    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    const topBid = bids.length > 0 ? Number(bids[0].amount) : null;

    // L'ordre d'obtention du verrou n'est pas déterministe, les deux issues sont
    // donc légitimes — c'est l'invariant qui compte, pas le décompte :
    //   • b1 (6) d'abord → b2 doit atteindre 7, ses 10 passent      → 2 mises
    //   • b2 (10) d'abord → b1 doit atteindre 11, ses 6 sont refusés → 1 mise
    expect(fulfilled).toBeGreaterThanOrEqual(1);
    if (fulfilled === 1) {
      const rejected = results.find((r) => r.status === "rejected");
      expect((rejected as PromiseRejectedResult).reason).toMatchObject({ message: "BID_TOO_LOW" });
    }

    // INVARIANT restauré : le prix courant est toujours la meilleure mise. C'est
    // exactement ce que la course cassait avant le verrou (currentPrice pouvait
    // valoir 6 alors que la meilleure mise était 10).
    expect(Number(auction.currentPrice)).toBe(topBid);
    expect(topBid).toBe(10);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 bis. Enchère automatique (proxy bidding)
  // ─────────────────────────────────────────────────────────────────────────
  it("enchère auto: le plafond ne se consomme pas — le leader ne paie que le minimum", async () => {
    const seller = await createTestUser(TAG, 70);
    const b1 = await createSolventBidder(TAG, 71);
    const b2 = await createSolventBidder(TAG, 72);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    // b1 arme un plafond à 250 en ne misant que 10.
    await bid(b1.id, auctionId, 10, { maxAmount: 250 });
    let auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(Number(auction.currentPrice)).toBe(10);

    // b2 monte à 40 : b1 doit reprendre la tête à 41, pas à 250.
    await bid(b2.id, auctionId, 40);
    auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(Number(auction.currentPrice)).toBe(41);

    const auto = await prisma.bid.findFirst({
      where: { auctionId, bidderId: b1.id, isAuto: true },
      orderBy: { amount: "desc" },
    });
    expect(auto).not.toBeNull();
    expect(Number(auto!.amount)).toBe(41);
  });

  it("enchère auto: le plafond engage le portefeuille, pas seulement la mise affichée", async () => {
    const seller = await createTestUser(TAG, 73);
    // Solde de 50 : la mise de 10 passerait, mais pas un plafond à 250.
    const poor = await createSolventBidder(TAG, 74, 50);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    await expect(bid(poor.id, auctionId, 10, { maxAmount: 250 })).rejects.toThrow(
      "INSUFFICIENT_WALLET",
    );
    // Sans plafond, la même mise passe.
    await expect(bid(poor.id, auctionId, 10)).resolves.toBeTruthy();
  });

  it("enchère auto: un leader devenu insolvable ne se défend qu'à hauteur de son solde", async () => {
    const seller = await createTestUser(TAG, 75);
    const rich = await createSolventBidder(TAG, 76, 1_000);
    const b1 = await createSolventBidder(TAG, 77, 1_000);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    await bid(b1.id, auctionId, 10, { maxAmount: 900 });
    // Le solde de b1 fond après coup (achat ailleurs) : son plafond n'est plus couvert.
    await prisma.walletAccount.update({
      where: { userId: b1.id },
      data: { depositBalance: 100, earnedBalance: 0 },
    });

    await bid(rich.id, auctionId, 200);
    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    // b1 ne peut pas monter à 201 : il s'arrête à 100, rich mène à 200 (sa saisie).
    expect(Number(auction.currentPrice)).toBe(200);
    expect(auction.currentPrice).toBeDefined();
    const winner = await prisma.bid.findFirstOrThrow({
      where: { auctionId },
      orderBy: { amount: "desc" },
    });
    expect(winner.bidderId).toBe(rich.id);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Règlement : la clôture crée la vente, encaisse et prélève la commission
  // ─────────────────────────────────────────────────────────────────────────
  it("settleDueAuctions en SOLD crée la vente, débite le gagnant et prélève la commission", async () => {
    const seller = await createTestUser(TAG, 60);
    const winner = await createSolventBidder(TAG, 61);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    await bid(winner.id, auctionId, 6);
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();

    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.status).toBe("SOLD");

    // La clôture délègue désormais au cycle de vie marketplace : vente adossée à une
    // annonce de règlement, paiement porteur de la commission, débit du gagnant.
    const sale = await prisma.sale.findUniqueOrThrow({ where: { auctionId } });
    expect(sale.buyerId).toBe(winner.id);
    expect(sale.sellerId).toBe(seller.id);
    expect(Number(sale.price)).toBe(6);
    // 5 % de 6 € = 0,30 €.
    expect(Number(sale.serviceFee)).toBeCloseTo(0.3, 2);

    const payment = await prisma.payment.findFirstOrThrow({ where: { auctionId } });
    expect(payment.kind).toBe("PURCHASE");
    expect(payment.payeeId).toBe(seller.id);
    expect(Number(payment.applicationFee)).toBeCloseTo(0.3, 2);

    // L'annonce support naît vendue : elle ne doit jamais remonter au catalogue.
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: sale.listingId } });
    expect(listing.status).toBe("SOLD");
    expect(listing.variantId).toBe(variantId);

    // Le gagnant est débité du prix d'adjudication (et pas de la commission, qui
    // est prélevée sur le versement vendeur).
    const purchase = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { saleId: sale.id, type: "PURCHASE" },
    });
    expect(Number(purchase.amount)).toBe(-6);
  });

  it("settleDueAuctions est idempotent sur le règlement : un 2e passage ne recrée ni vente ni débit", async () => {
    const seller = await createTestUser(TAG, 80);
    const winner = await createSolventBidder(TAG, 81);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    await bid(winner.id, auctionId, 6);
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();
    await settleDueAuctions();

    expect(await prisma.sale.count({ where: { auctionId } })).toBe(1);
    expect(await prisma.payment.count({ where: { auctionId } })).toBe(1);
    const debits = await prisma.walletLedgerEntry.count({
      where: { type: "PURCHASE", wallet: { userId: winner.id } },
    });
    expect(debits).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Option payante « enchère automatique »
  // ─────────────────────────────────────────────────────────────────────────
  it("l'option payante est requise pour armer un plafond, et n'est facturée qu'une fois", async () => {
    const seller = await createTestUser(TAG, 90);
    const bidder = await createSolventBidder(TAG, 91);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    // Sans option : le plafond est refusé.
    await expect(bid(bidder.id, auctionId, 6, { maxAmount: 100 })).rejects.toThrow(
      "AUTO_BID_NOT_UNLOCKED",
    );

    expect(await purchaseAutoBidOption(bidder.id, auctionId)).toBe(true);
    // Second achat : idempotent, aucun débit supplémentaire.
    expect(await purchaseAutoBidOption(bidder.id, auctionId)).toBe(false);

    const fees = await prisma.walletLedgerEntry.findMany({
      where: { auctionId, type: "AUCTION_OPTION", wallet: { userId: bidder.id } },
    });
    expect(fees).toHaveLength(1);
    expect(Number(fees[0].amount)).toBe(-AUTO_BID_OPTION_FEE_EUR);

    // Avec l'option, le plafond passe.
    await expect(bid(bidder.id, auctionId, 6, { maxAmount: 100 })).resolves.toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Inscription obligatoire, expédition et transfert de propriété
  // ─────────────────────────────────────────────────────────────────────────
  it("placeBid rejette NOT_REGISTERED tant que le participant n'a pas déclaré sa livraison", async () => {
    const seller = await createTestUser(TAG, 100);
    const bidder = await createSolventBidder(TAG, 101);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });

    await expect(placeBid(bidder.id, auctionId, 6)).rejects.toThrow("NOT_REGISTERED");

    await registerForAuction(bidder.id, auctionId, { shippingMode: "HAND_DELIVERY" });
    await expect(placeBid(bidder.id, auctionId, 6)).resolves.toBeTruthy();
  });

  it("l'inscription exige une adresse dès que l'envoi n'est pas en main propre", async () => {
    const seller = await createTestUser(TAG, 102);
    const bidder = await createSolventBidder(TAG, 103);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });

    await expect(
      registerForAuction(bidder.id, auctionId, { shippingMode: "COLISSIMO" }),
    ).rejects.toThrow("ADDRESS_REQUIRED");

    const address = await prisma.address.create({
      data: {
        userId: bidder.id,
        fullName: "QA Testeur",
        line1: "1 rue du Test",
        zip: "75001",
        city: "Paris",
        country: "FR",
      },
    });
    await registerForAuction(bidder.id, auctionId, {
      shippingMode: "COLISSIMO",
      addressId: address.id,
    });

    const reg = await prisma.auctionRegistration.findUniqueOrThrow({
      where: { auctionId_userId: { auctionId, userId: bidder.id } },
    });
    expect(reg.shippingMode).toBe("COLISSIMO");
    // Frais figés à l'inscription depuis le barème (Colissimo = 5,90 €).
    expect(Number(reg.shippingCost)).toBeCloseTo(5.9, 2);
  });

  it("le port choisi entre dans le contrôle de solde et dans la vente adjugée", async () => {
    const seller = await createTestUser(TAG, 104);
    // 100 € pile : la mise seule passerait, mais pas la mise + 5,90 € de port.
    const bidder = await createSolventBidder(TAG, 105, 100);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    const address = await prisma.address.create({
      data: {
        userId: bidder.id,
        fullName: "QA Testeur",
        line1: "1 rue du Test",
        zip: "75001",
        city: "Paris",
        country: "FR",
      },
    });
    await registerForAuction(bidder.id, auctionId, {
      shippingMode: "COLISSIMO",
      addressId: address.id,
    });

    await expect(placeBid(bidder.id, auctionId, 100)).rejects.toThrow("INSUFFICIENT_WALLET");
    await placeBid(bidder.id, auctionId, 90);

    await setEndsAt(auctionId, new Date(Date.now() - 1_000));
    await settleDueAuctions();

    const sale = await prisma.sale.findUniqueOrThrow({ where: { auctionId } });
    expect(sale.shippingMode).toBe("COLISSIMO");
    expect(Number(sale.shippingCost)).toBeCloseTo(5.9, 2);
    // Snapshot immuable de l'adresse au moment de l'adjudication.
    expect(sale.deliveryAddress).toMatchObject({ zip: "75001", city: "Paris" });

    // Le gagnant règle l'adjudication ET le port.
    const purchase = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { saleId: sale.id, type: "PURCHASE" },
    });
    expect(Number(purchase.amount)).toBeCloseTo(-95.9, 2);
  });

  it("l'adjudication transfère l'exemplaire : le vendeur le perd, le gagnant l'obtient", async () => {
    const seller = await createTestUser(TAG, 106);
    const winner = await createSolventBidder(TAG, 107);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });
    await bid(winner.id, auctionId, 6);
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();

    const sellerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    expect(sellerItem.quantity).toBe(0);
    expect(sellerItem.reservedQuantity).toBe(0);
    expect(sellerItem.forSale).toBe(false);

    const winnerItem = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: winner.id, variantId },
    });
    expect(winnerItem.quantity).toBe(1);
  });

  it("une enchère close sans acheteur rend l'exemplaire au vendeur", async () => {
    const seller = await createTestUser(TAG, 108);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, { variantId, startPrice: 5, durationDays: 3 });
    await setEndsAt(auctionId, new Date(Date.now() - 1_000));

    await settleDueAuctions();

    const item = await prisma.collectionItem.findFirstOrThrow({
      where: { userId: seller.id, variantId },
    });
    // Aucune vente : la réservation retombe et la carte reste au vendeur.
    expect(item.quantity).toBe(1);
    expect(item.reservedQuantity).toBe(0);
    expect(item.forSale).toBe(false);
  });

  it("le vendeur ne peut pas acheter l'option sur sa propre enchère", async () => {
    const seller = await createSolventBidder(TAG, 92);
    const { variants } = await createTestCatalog(catalogTag(), 1);
    const variantId = variants[0].id;
    await addToCollection(seller.id, variantId, { quantity: 1 });
    const auctionId = await createAuction(seller.id, {
      variantId,
      startPrice: 5,
      durationDays: 3,
      bidIncrement: 1,
    });

    await expect(purchaseAutoBidOption(seller.id, auctionId)).rejects.toThrow("SELF_BID");
  });
});
