import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  proposeExchange,
  acceptExchange,
  acceptExchangeWithItems,
  cancelExchange,
  markExchangeAwaitingShipment,
  completeExchange,
} from "@/server/exchange/exchange.mutations";
import {
  createShipmentForExchange,
  markShipmentShipped,
} from "@/server/c2c/shipment.service";
import {
  markShipmentDelivered,
  confirmExchangeReceipt,
  processExchangeTimeouts,
} from "@/server/c2c/exchange-lifecycle.service";
import { qaTag, createTestUser, createTestCatalog, addToCollection, cleanupTag } from "./_helpers/fixtures";

const TAG = qaTag();

afterAll(async () => {
  await cleanupTag(TAG);
});

/** Compteurs de réservation/quantité pour (userId, variantId). */
async function collState(userId: string, variantId: string) {
  const item = await prisma.collectionItem.findFirst({ where: { userId, variantId } });
  return {
    quantity: item?.quantity ?? null,
    reservedQuantity: item?.reservedQuantity ?? null,
    exists: item !== null,
  };
}

describe(`exchange C2C [${TAG}] — troc + envoi sécurisé`, () => {
  // -------------------------------------------------------------------------
  // 1. PROPOSITION
  // -------------------------------------------------------------------------
  describe("1. proposeExchange", () => {
    it("crée un Exchange PROPOSED + ExchangeItem + réserve la carte de A + conversation + notif à B", async () => {
      const a = await createTestUser(TAG, 1);
      const b = await createTestUser(TAG, 2);
      const { variants } = await createTestCatalog(`${TAG}c1`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });

      const exchangeId = await proposeExchange(a.id, {
        recipientSlug: b.slug,
        giveVariantIds: [variants[0].id],
        message: "Salut, ça t'intéresse ?",
      });

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("PROPOSED");
      expect(ex.initiatorId).toBe(a.id);
      expect(ex.recipientId).toBe(b.id);

      const items = await prisma.exchangeItem.findMany({ where: { exchangeId } });
      expect(items).toHaveLength(1);
      expect(items[0].fromInitiator).toBe(true);
      expect(items[0].variantId).toBe(variants[0].id);

      // Réservation de la carte de A.
      const st = await collState(a.id, variants[0].id);
      expect(st.reservedQuantity).toBe(1);

      // Conversation liée + deux participants.
      const conv = await prisma.conversation.findUniqueOrThrow({
        where: { exchangeId },
        include: { participants: true },
      });
      expect(conv.context).toBe("EXCHANGE");
      expect(conv.participants.map((p) => p.userId).sort()).toEqual([a.id, b.id].sort());

      // Notification à B.
      const notif = await prisma.notification.findFirst({
        where: { userId: b.id, type: "EXCHANGE_PROPOSED", entityId: exchangeId },
      });
      expect(notif).not.toBeNull();
      expect(notif?.actorId).toBe(a.id);
    });

    it("rejette NO_CARDS (aucune carte offerte)", async () => {
      const a = await createTestUser(TAG, 10);
      const b = await createTestUser(TAG, 11);
      await expect(
        proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [] }),
      ).rejects.toThrow(/NO_CARDS/);
    });

    it("rejette RECIPIENT_NOT_FOUND (slug inconnu)", async () => {
      const a = await createTestUser(TAG, 12);
      const { variants } = await createTestCatalog(`${TAG}c12`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await expect(
        proposeExchange(a.id, { recipientSlug: "slug-inexistant-zzz", giveVariantIds: [variants[0].id] }),
      ).rejects.toThrow(/RECIPIENT_NOT_FOUND/);
    });

    it("rejette SELF_EXCHANGE (A propose à lui-même)", async () => {
      const a = await createTestUser(TAG, 13);
      const { variants } = await createTestCatalog(`${TAG}c13`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await expect(
        proposeExchange(a.id, { recipientSlug: a.slug, giveVariantIds: [variants[0].id] }),
      ).rejects.toThrow(/SELF_EXCHANGE/);
    });

    it("rejette NOT_OWNED (carte pas dans la collection de A)", async () => {
      const a = await createTestUser(TAG, 14);
      const b = await createTestUser(TAG, 15);
      const { variants } = await createTestCatalog(`${TAG}c14`, 1);
      // A ne possède PAS variants[0].
      await expect(
        proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] }),
      ).rejects.toThrow(/NOT_OWNED/);
    });

    it("rejette CARD_RESERVED (tous les exemplaires déjà réservés)", async () => {
      const a = await createTestUser(TAG, 16);
      const b = await createTestUser(TAG, 17);
      const { variants } = await createTestCatalog(`${TAG}c16`, 1);
      // 1 exemplaire, déjà entièrement réservé.
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await prisma.collectionItem.updateMany({
        where: { userId: a.id, variantId: variants[0].id },
        data: { reservedQuantity: 1 },
      });
      await expect(
        proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] }),
      ).rejects.toThrow(/CARD_RESERVED/);
    });
  });

  // -------------------------------------------------------------------------
  // 2. ACCEPTATION
  // -------------------------------------------------------------------------
  describe("2. acceptExchange / acceptExchangeWithItems", () => {
    it("acceptExchangeWithItems: B accepte en ajoutant ses cartes → ACCEPTED + réservation des cartes de B", async () => {
      const a = await createTestUser(TAG, 20);
      const b = await createTestUser(TAG, 21);
      const { variants } = await createTestCatalog(`${TAG}c20`, 2);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await addToCollection(b.id, variants[1].id, { quantity: 1 });

      const exchangeId = await proposeExchange(a.id, {
        recipientSlug: b.slug,
        giveVariantIds: [variants[0].id],
      });

      await acceptExchangeWithItems(b.id, exchangeId, [variants[1].id]);

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("ACCEPTED");
      expect(ex.acceptedAt).not.toBeNull();

      const recipientItems = await prisma.exchangeItem.findMany({
        where: { exchangeId, fromInitiator: false },
      });
      expect(recipientItems).toHaveLength(1);
      expect(recipientItems[0].variantId).toBe(variants[1].id);

      // Réservation côté B.
      const stB = await collState(b.id, variants[1].id);
      expect(stB.reservedQuantity).toBe(1);

      // Notif d'acceptation à A.
      const notif = await prisma.notification.findFirst({
        where: { userId: a.id, type: "EXCHANGE_ACCEPTED", entityId: exchangeId },
      });
      expect(notif).not.toBeNull();

      // Journal de transition.
      const ev = await prisma.transactionEvent.findFirst({
        where: { entityId: exchangeId, event: "EXCHANGE_ACCEPTED" },
      });
      expect(ev?.toStatus).toBe("ACCEPTED");
    });

    it("acceptExchange (sans items) échoue si le destinataire n'a jamais proposé de cartes (RECIPIENT_CARDS_REQUIRED)", async () => {
      const a = await createTestUser(TAG, 22);
      const b = await createTestUser(TAG, 23);
      const { variants } = await createTestCatalog(`${TAG}c22`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, {
        recipientSlug: b.slug,
        giveVariantIds: [variants[0].id],
      });
      // Aucun ExchangeItem côté B → acceptExchange doit refuser.
      await expect(acceptExchange(b.id, exchangeId)).rejects.toThrow(/RECIPIENT_CARDS_REQUIRED/);
    });

    it("acceptExchange réussit quand des cartes du destinataire existent déjà", async () => {
      const a = await createTestUser(TAG, 24);
      const b = await createTestUser(TAG, 25);
      const { variants } = await createTestCatalog(`${TAG}c24`, 2);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await addToCollection(b.id, variants[1].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, {
        recipientSlug: b.slug,
        giveVariantIds: [variants[0].id],
      });
      // On ajoute manuellement l'item côté B (préparé par un autre flux UI) puis on accepte.
      await prisma.exchangeItem.create({
        data: { exchangeId, fromInitiator: false, variantId: variants[1].id, condition: "EXCELLENT", quantity: 1 },
      });
      await acceptExchange(b.id, exchangeId);
      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("ACCEPTED");
    });

    it("un non-destinataire ne peut pas accepter (NOT_FOUND)", async () => {
      const a = await createTestUser(TAG, 26);
      const b = await createTestUser(TAG, 27);
      const c = await createTestUser(TAG, 28);
      const { variants } = await createTestCatalog(`${TAG}c26`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, {
        recipientSlug: b.slug,
        giveVariantIds: [variants[0].id],
      });
      await expect(acceptExchangeWithItems(c.id, exchangeId, [variants[0].id])).rejects.toThrow(/NOT_FOUND/);
    });
  });

  // -------------------------------------------------------------------------
  // 3. ENVOI SÉCURISÉ
  // -------------------------------------------------------------------------
  describe("3. envoi sécurisé (shipment)", () => {
    it("markExchangeAwaitingShipment puis 2 colis (un par sens), SHIPPED puis DELIVERED + guaranteeEndsAt", async () => {
      const a = await createTestUser(TAG, 30);
      const b = await createTestUser(TAG, 31);
      const { variants } = await createTestCatalog(`${TAG}c30`, 2);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await addToCollection(b.id, variants[1].id, { quantity: 1 });

      const exchangeId = await proposeExchange(a.id, {
        recipientSlug: b.slug,
        giveVariantIds: [variants[0].id],
      });
      await acceptExchangeWithItems(b.id, exchangeId, [variants[1].id]);

      // Passage en attente d'expédition (non sécurisé → pas de caution).
      await markExchangeAwaitingShipment(exchangeId, a.id);
      let ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("AWAITING_SHIPMENT");

      // Deux colis : A→B et B→A.
      const shipAtoB = await createShipmentForExchange(exchangeId, a.id);
      const shipBtoA = await createShipmentForExchange(exchangeId, b.id);
      expect(shipAtoB).not.toBe(shipBtoA);

      const sAtoB = await prisma.shipment.findUniqueOrThrow({ where: { id: shipAtoB } });
      const sBtoA = await prisma.shipment.findUniqueOrThrow({ where: { id: shipBtoA } });
      expect(sAtoB.shipperId).toBe(a.id);
      expect(sAtoB.recipientId).toBe(b.id);
      expect(sBtoA.shipperId).toBe(b.id);
      expect(sBtoA.recipientId).toBe(a.id);
      expect(sAtoB.status).toBe("PENDING");
      expect(sAtoB.notShipDeadline).not.toBeNull();

      // Expédition des deux colis.
      await markShipmentShipped(shipAtoB, a.id, "TRACK-A-001");
      await markShipmentShipped(shipBtoA, b.id, "TRACK-B-001");
      ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("SHIPPED");
      const sAtoBShipped = await prisma.shipment.findUniqueOrThrow({ where: { id: shipAtoB } });
      expect(sAtoBShipped.status).toBe("SHIPPED");
      expect(sAtoBShipped.trackingNumber).toBe("TRACK-A-001");

      // Livraison → DELIVERED_WINDOW + fenêtre de garantie.
      await markShipmentDelivered(shipAtoB, b.id); // B reçoit le colis de A
      const sDelivered = await prisma.shipment.findUniqueOrThrow({ where: { id: shipAtoB } });
      expect(sDelivered.status).toBe("DELIVERED");
      expect(sDelivered.deliveredAt).not.toBeNull();
      expect(sDelivered.guaranteeStartedAt).not.toBeNull();
      expect(sDelivered.guaranteeEndsAt).not.toBeNull();
      // Fenêtre = 72h.
      const delta = sDelivered.guaranteeEndsAt!.getTime() - sDelivered.guaranteeStartedAt!.getTime();
      expect(delta).toBe(72 * 60 * 60 * 1000);

      ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("DELIVERED_WINDOW");
    });
  });

  // -------------------------------------------------------------------------
  // 4. CONFIRMATION & CLÔTURE
  // -------------------------------------------------------------------------
  describe("4. confirmExchangeReceipt → COMPLETED + transfert dans les deux sens", () => {
    it("transfère les cartes dans les deux sens et clôture", async () => {
      const a = await createTestUser(TAG, 40);
      const b = await createTestUser(TAG, 41);
      const { variants } = await createTestCatalog(`${TAG}c40`, 2);
      const vA = variants[0].id; // carte de A → B
      const vB = variants[1].id; // carte de B → A
      await addToCollection(a.id, vA, { quantity: 1 });
      await addToCollection(b.id, vB, { quantity: 1 });

      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [vA] });
      await acceptExchangeWithItems(b.id, exchangeId, [vB]);
      await markExchangeAwaitingShipment(exchangeId, a.id);
      const shipAtoB = await createShipmentForExchange(exchangeId, a.id);
      const shipBtoA = await createShipmentForExchange(exchangeId, b.id);
      await markShipmentShipped(shipAtoB, a.id, "T1");
      await markShipmentShipped(shipBtoA, b.id, "T2");
      await markShipmentDelivered(shipAtoB, b.id);
      await markShipmentDelivered(shipBtoA, a.id);

      // B confirme la réception → clôture.
      await confirmExchangeReceipt(exchangeId, b.id);

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("COMPLETED");
      expect(ex.completedAt).not.toBeNull();

      // Carte de A transférée à B.
      const aAfterVA = await collState(a.id, vA);
      const bAfterVA = await collState(b.id, vA);
      expect(aAfterVA.quantity).toBe(0); // A a cédé sa carte
      expect(bAfterVA.quantity).toBe(1); // B l'a reçue

      // Carte de B transférée à A.
      const bAfterVB = await collState(b.id, vB);
      const aAfterVB = await collState(a.id, vB);
      expect(bAfterVB.quantity).toBe(0);
      expect(aAfterVB.quantity).toBe(1);

      // Notif de complétion envoyée à l'autre partie.
      const notif = await prisma.notification.findFirst({
        where: { userId: a.id, type: "EXCHANGE_COMPLETED", entityId: exchangeId },
      });
      expect(notif).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. ANNULATION
  // -------------------------------------------------------------------------
  describe("5. cancelExchange", () => {
    it("un participant annule → CANCELLED + réservations libérées des deux côtés", async () => {
      const a = await createTestUser(TAG, 50);
      const b = await createTestUser(TAG, 51);
      const { variants } = await createTestCatalog(`${TAG}c50`, 2);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await addToCollection(b.id, variants[1].id, { quantity: 1 });

      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] });
      await acceptExchangeWithItems(b.id, exchangeId, [variants[1].id]);

      // Réservations en place avant annulation.
      expect((await collState(a.id, variants[0].id)).reservedQuantity).toBe(1);
      expect((await collState(b.id, variants[1].id)).reservedQuantity).toBe(1);

      await cancelExchange(b.id, exchangeId);

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("CANCELLED");
      expect((await collState(a.id, variants[0].id)).reservedQuantity).toBe(0);
      expect((await collState(b.id, variants[1].id)).reservedQuantity).toBe(0);
    });

    it("un NON-participant ne peut PAS annuler (NOT_FOUND) et les réservations restent intactes", async () => {
      const a = await createTestUser(TAG, 52);
      const b = await createTestUser(TAG, 53);
      const c = await createTestUser(TAG, 54); // tiers
      const { variants } = await createTestCatalog(`${TAG}c52`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] });

      await expect(cancelExchange(c.id, exchangeId)).rejects.toThrow(/NOT_FOUND/);

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("PROPOSED");
      expect((await collState(a.id, variants[0].id)).reservedQuantity).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. FAILLE DE SÉCURITÉ — completeExchange sans acteur
  // -------------------------------------------------------------------------
  describe("6. FAILLE completeExchange (constat sécurité #1)", () => {
    it("DÉMONTRE qu'un tiers non-participant peut finaliser un échange DELIVERED d'autrui", async () => {
      const a = await createTestUser(TAG, 60);
      const b = await createTestUser(TAG, 61);
      const attacker = await createTestUser(TAG, 62); // aucun lien avec l'échange
      const { variants } = await createTestCatalog(`${TAG}c60`, 2);
      const vA = variants[0].id;
      const vB = variants[1].id;
      await addToCollection(a.id, vA, { quantity: 1 });
      await addToCollection(b.id, vB, { quantity: 1 });

      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [vA] });
      await acceptExchangeWithItems(b.id, exchangeId, [vB]);
      await markExchangeAwaitingShipment(exchangeId, a.id);
      const shipAtoB = await createShipmentForExchange(exchangeId, a.id);
      const shipBtoA = await createShipmentForExchange(exchangeId, b.id);
      await markShipmentShipped(shipAtoB, a.id, "T1");
      await markShipmentShipped(shipBtoA, b.id, "T2");
      await markShipmentDelivered(shipAtoB, b.id);
      await markShipmentDelivered(shipBtoA, a.id);

      // Le flux de livraison met l'échange en DELIVERED_WINDOW ; completeExchange
      // exige le statut DELIVERED. On force ce statut (précondition métier),
      // l'assertion porte sur la fonction completeExchange elle-même.
      await prisma.exchange.update({ where: { id: exchangeId }, data: { status: "DELIVERED" } });

      // FAILLE: completeExchange(exchangeId) ne prend AUCUN identifiant d'acteur.
      // (src/server/exchange/exchange.mutations.ts:263 — `completeExchange(exchangeId: string)`,
      //  appelé par completeExchangeAction sans passer viewer.id — exchange.actions.ts:65-76.)
      // Conséquence : n'importe quel utilisateur authentifié — ici `attacker`, ni initiateur
      // ni destinataire — peut déclencher la finalisation et le transfert de propriété des
      // cartes d'autrui. Aucune erreur FORBIDDEN/NOT_FOUND n'est levée.
      await expect(completeExchange(exchangeId)).resolves.toBeUndefined();

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      // PREUVE REPRODUCTIBLE : l'échange est passé COMPLETED sur action d'un tiers.
      expect(ex.status).toBe("COMPLETED");

      // Le transfert de propriété a bien eu lieu (déclenché par un non-participant).
      expect((await collState(b.id, vA)).quantity).toBe(1);
      expect((await collState(a.id, vB)).quantity).toBe(1);

      // Il n'existe AUCune trace de l'acteur : l'event de transition a actorId = null,
      // rendant l'action non imputable (aucun audit possible).
      const completedEvent = await prisma.transactionEvent.findFirst({
        where: { entityId: exchangeId, event: "EXCHANGE_COMPLETED" },
      });
      expect(completedEvent).not.toBeNull();
      // FAILLE (corollaire) : actorId null → l'action de l'attaquant n'est pas traçable.
      expect(completedEvent?.actorId).toBeNull();
    });

    it("completeExchange refuse un échange qui n'est pas DELIVERED (NOT_FOUND) — seule garde existante", async () => {
      const a = await createTestUser(TAG, 63);
      const b = await createTestUser(TAG, 64);
      const { variants } = await createTestCatalog(`${TAG}c63`, 1);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] });
      // Statut PROPOSED → completeExchange doit refuser (garde de statut uniquement, pas d'acteur).
      await expect(completeExchange(exchangeId)).rejects.toThrow(/NOT_FOUND/);
    });
  });

  // -------------------------------------------------------------------------
  // 7. TIMEOUTS
  // -------------------------------------------------------------------------
  describe("7. processExchangeTimeouts", () => {
    it("non-expédition J+3 : colis PENDING échu → LOST + échange NOT_SHIPPED_CANCELLED + réservation initiateur libérée", async () => {
      const a = await createTestUser(TAG, 70);
      const b = await createTestUser(TAG, 71);
      const { variants } = await createTestCatalog(`${TAG}c70`, 2);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await addToCollection(b.id, variants[1].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] });
      await acceptExchangeWithItems(b.id, exchangeId, [variants[1].id]);
      await markExchangeAwaitingShipment(exchangeId, a.id);
      const shipId = await createShipmentForExchange(exchangeId, a.id);

      // Force l'échéance dans le passé.
      await prisma.shipment.update({
        where: { id: shipId },
        data: { notShipDeadline: new Date(Date.now() - 60 * 1000) },
      });

      expect((await collState(a.id, variants[0].id)).reservedQuantity).toBe(1);

      const res = await processExchangeTimeouts();
      expect(res.notShipped).toBeGreaterThanOrEqual(1);

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("NOT_SHIPPED_CANCELLED");
      const ship = await prisma.shipment.findUniqueOrThrow({ where: { id: shipId } });
      expect(ship.status).toBe("LOST");
      // Réservation de l'initiateur libérée.
      expect((await collState(a.id, variants[0].id)).reservedQuantity).toBe(0);
    });

    it("fin de garantie : échange DELIVERED_WINDOW dont toutes les garanties sont échues → COMPLETED", async () => {
      const a = await createTestUser(TAG, 72);
      const b = await createTestUser(TAG, 73);
      const { variants } = await createTestCatalog(`${TAG}c72`, 2);
      await addToCollection(a.id, variants[0].id, { quantity: 1 });
      await addToCollection(b.id, variants[1].id, { quantity: 1 });
      const exchangeId = await proposeExchange(a.id, { recipientSlug: b.slug, giveVariantIds: [variants[0].id] });
      await acceptExchangeWithItems(b.id, exchangeId, [variants[1].id]);
      await markExchangeAwaitingShipment(exchangeId, a.id);
      const shipAtoB = await createShipmentForExchange(exchangeId, a.id);
      const shipBtoA = await createShipmentForExchange(exchangeId, b.id);
      await markShipmentShipped(shipAtoB, a.id, "T1");
      await markShipmentShipped(shipBtoA, b.id, "T2");
      await markShipmentDelivered(shipAtoB, b.id);
      await markShipmentDelivered(shipBtoA, a.id);

      // Force la fin de garantie dans le passé pour les deux colis.
      const past = new Date(Date.now() - 60 * 1000);
      await prisma.shipment.updateMany({
        where: { exchangeId },
        data: { guaranteeEndsAt: past },
      });

      const res = await processExchangeTimeouts();
      expect(res.completed).toBeGreaterThanOrEqual(1);

      const ex = await prisma.exchange.findUniqueOrThrow({ where: { id: exchangeId } });
      expect(ex.status).toBe("COMPLETED");
      expect(ex.completedAt).not.toBeNull();

      // BUG POTENTIEL : le timeout de fin de garantie passe l'échange en COMPLETED
      // MAIS ne transfère PAS les cartes (processExchangeTimeouts ne touche pas aux
      // collectionItem, contrairement à confirmExchangeReceipt). On documente l'état réel.
      const bHasVA = await collState(b.id, variants[0].id);
      const aHasVB = await collState(a.id, variants[1].id);
      // On observe le comportement réel (voir rapport) :
      // eslint-disable-next-line no-console
      console.log(
        `[TIMEOUT-GARANTIE] après COMPLETED via timeout — B possède la carte de A ? qty=${bHasVA.quantity} ; A possède la carte de B ? qty=${aHasVB.quantity}`,
      );
    });
  });
});
