import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { evaluateUserBadges, evaluateUserBadgesSafe, syncBadgeCatalog } from "@/server/badge/badge.service";
import { addCollectionItem } from "@/server/collection/collection.mutations";
import { BADGE_DEFINITIONS } from "@/lib/badges";
import { qaTag, createTestUser, addToCollection, cleanupTag } from "../_helpers/fixtures";
import { createCustomCatalog } from "./helpers";

const TAG = qaTag();
/** Succès « Contact Mis » : première carte ajoutée au classeur. */
const FIRST_CARD = "apprenti_contact_mis";

let u1: Awaited<ReturnType<typeof createTestUser>>;
let u2: Awaited<ReturnType<typeof createTestUser>>;
let catalog: Awaited<ReturnType<typeof createCustomCatalog>>;

beforeAll(async () => {
  u1 = await createTestUser(TAG, 1);
  u2 = await createTestUser(TAG, 2);
  catalog = await createCustomCatalog(TAG, "bdg", { cardCount: 3 });
});

afterAll(async () => {
  await cleanupTag(TAG);
});

async function userBadgeCodes(userId: string): Promise<string[]> {
  const rows = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: { select: { code: true } } },
  });
  return rows.map((r) => r.badge.code);
}

describe(`badges [${TAG}] — synchronisation du catalogue client`, () => {
  it("syncBadgeCatalog crée tous les succès de la liste client (idempotent)", async () => {
    await syncBadgeCatalog();
    await syncBadgeCatalog(); // seconde passe : ne doit rien dupliquer

    for (const def of BADGE_DEFINITIONS) {
      const rows = await prisma.badge.findMany({ where: { code: def.code } });
      expect(rows, def.code).toHaveLength(1);
      expect(rows[0].label).toBe(def.label);
      expect(rows[0].icon).toBe(def.icon);
    }
  });

  it("les badges hérités hors liste sont purgés (avec leurs déblocages)", async () => {
    const legacy = await prisma.badge.create({
      data: { code: `legacy_qa_${TAG}`, label: "Ancien badge", description: "obsolète" },
    });
    await prisma.userBadge.create({ data: { userId: u1.id, badgeId: legacy.id } });

    await syncBadgeCatalog();

    expect(await prisma.badge.findUnique({ where: { code: legacy.code } })).toBeNull();
    expect(await prisma.userBadge.count({ where: { badgeId: legacy.id } })).toBe(0);
  });
});

describe(`badges [${TAG}] — attribution automatique`, () => {
  it("sans carte : « Contact Mis » n'est pas attribué", async () => {
    const unlocked = await evaluateUserBadges(u1.id);
    expect(unlocked).not.toContain(FIRST_CARD);
    expect(await userBadgeCodes(u1.id)).not.toContain(FIRST_CARD);
  });

  it("première carte ajoutée → « Contact Mis » débloqué avec notification", async () => {
    await addToCollection(u1.id, catalog.variants[0].id, {});

    const unlocked = await evaluateUserBadges(u1.id);
    expect(unlocked).toContain(FIRST_CARD);

    const rows = await prisma.userBadge.findMany({
      where: { userId: u1.id, badge: { code: FIRST_CARD } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].progress).toBe(100);

    const notifs = await prisma.notification.findMany({
      where: { userId: u1.id, type: "BADGE_UNLOCKED" },
    });
    const notifCodes = notifs.map((n) => (n.payload as { code?: string } | null)?.code);
    expect(notifCodes).toContain(FIRST_CARD);
  });

  it("réévaluation idempotente : pas de double déblocage ni de doublon UserBadge", async () => {
    const unlockedAgain = await evaluateUserBadges(u1.id);
    expect(unlockedAgain).not.toContain(FIRST_CARD);

    const rows = await prisma.userBadge.findMany({
      where: { userId: u1.id, badge: { code: FIRST_CARD } },
    });
    expect(rows).toHaveLength(1);
  });

  it("le hook des mutations collection (evaluateUserBadgesSafe) débloque sans appel explicite", async () => {
    await addCollectionItem(u2.id, catalog.variants[1].id, "EXCELLENT", 1);
    expect(await userBadgeCodes(u2.id)).toContain(FIRST_CARD);
  });
});

describe(`badges [${TAG}] — gestion d'erreurs`, () => {
  it("utilisateur inexistant : evaluateUserBadges ne débloque rien et ne plante pas", async () => {
    const ghost = `user-inexistant-${TAG}`;
    await expect(evaluateUserBadges(ghost)).resolves.toEqual([]);
    expect(await prisma.userBadge.count({ where: { userId: ghost } })).toBe(0);
  });

  it("evaluateUserBadgesSafe n'émet jamais d'exception (variante tolérante)", async () => {
    await expect(evaluateUserBadgesSafe(`user-inexistant-${TAG}`)).resolves.toBeUndefined();
  });
});
