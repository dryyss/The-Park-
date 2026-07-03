import { prisma } from "@/lib/prisma";

/**
 * Helpers locaux du domaine collection/wishlist/catalogue/badges.
 * Complètent test/integration/_helpers/fixtures.ts (qu'on ne modifie pas) :
 * - catalogue personnalisé (marque, versionType "standard", numéros de carte uniques) ;
 * - nettoyage des Badge rows créées dynamiquement pour un tag.
 *
 * Conventions de tag respectées pour que cleanupTag() ramasse tout :
 * - Season.code commence par `QA-${tag}` ;
 * - Rarity.code / VersionType.code dédiés commencent par `QA-${tag}` ;
 * - slugs de cartes préfixés `qa-${tag}`.
 */

/** Rareté partagée du catalogue produit (ex. "c") — créée si absente, jamais supprimée. */
export async function ensureSharedRarity(code: string, label: string) {
  const existing = await prisma.rarity.findUnique({ where: { code } });
  if (existing) return existing;
  try {
    return await prisma.rarity.create({ data: { code, label } });
  } catch {
    // course avec un autre agent : la ligne vient d'être créée.
    return prisma.rarity.findUniqueOrThrow({ where: { code } });
  }
}

/** VersionType partagé du catalogue produit (ex. "standard") — créé si absent, jamais supprimé. */
export async function ensureSharedVersionType(code: string, label: string) {
  const existing = await prisma.versionType.findUnique({ where: { code } });
  if (existing) return existing;
  try {
    return await prisma.versionType.create({ data: { code, label } });
  } catch {
    return prisma.versionType.findUniqueOrThrow({ where: { code } });
  }
}

export interface CustomCatalogOptions {
  cardCount?: number;
  /** Marque appliquée aux cartes (alimente les badges brand_complete_*). */
  brand?: string;
  /** Code de rareté partagé ("c"…) — sinon rareté dédiée au tag. */
  sharedRarityCode?: string;
  /** true → versionType "standard" (visible dans les vues actives du catalogue). */
  useStandardVersion?: boolean;
  /** Premier numéro de carte (uniques globalement pour éviter les collisions inter-agents). */
  baseNumber?: number;
  /** editionLabel appliqué à chaque variante (ex. "1ère édition"). */
  editionLabel?: string | null;
}

/** Numéro de carte improbable pour éviter les collisions entre agents (adjust par numéro). */
export function uniqueCardNumber(): number {
  return 100_000 + Math.floor(Math.random() * 800_000);
}

export async function createCustomCatalog(tag: string, suffix: string, opts: CustomCatalogOptions = {}) {
  const cardCount = opts.cardCount ?? 1;
  const baseNumber = opts.baseNumber ?? uniqueCardNumber();

  const rarity = opts.sharedRarityCode
    ? await ensureSharedRarity(opts.sharedRarityCode, `Rareté ${opts.sharedRarityCode}`)
    : await prisma.rarity.create({
        data: { code: `QA-${tag}-${suffix}-r`, label: `QA ${tag} ${suffix} rarity` },
      });

  const versionType = opts.useStandardVersion
    ? await ensureSharedVersionType("standard", "Standard")
    : await prisma.versionType.create({
        data: { code: `QA-${tag}-${suffix}-v`, label: `QA ${tag} ${suffix} version` },
      });

  const season = await prisma.season.create({
    data: { code: `QA-${tag}-${suffix}`, name: `QA Season ${tag} ${suffix}` },
  });

  const cards = [];
  const variants = [];
  for (let n = 0; n < cardCount; n++) {
    const card = await prisma.card.create({
      data: {
        seasonId: season.id,
        number: baseNumber + n,
        name: `QA ${tag} ${suffix} card ${n + 1}`,
        slug: `qa-${tag}-${suffix}-card-${n + 1}`,
        rarityId: rarity.id,
        brand: opts.brand ?? null,
      },
    });
    const variant = await prisma.cardVariant.create({
      data: {
        cardId: card.id,
        versionTypeId: versionType.id,
        language: "FR",
        editionLabel: opts.editionLabel ?? null,
      },
    });
    cards.push(card);
    variants.push(variant);
  }

  return { season, rarity, versionType, cards, variants, baseNumber };
}

/**
 * Supprime les Badge rows générées dynamiquement pour ce tag
 * (season_complete_qa-<tag>* / brand_complete_qa<tag>*), après leurs UserBadge.
 */
export async function cleanupTagBadges(tag: string): Promise<void> {
  const badges = await prisma.badge.findMany({
    where: { code: { contains: tag.toLowerCase() } },
    select: { id: true },
  });
  const ids = badges.map((b) => b.id);
  if (ids.length === 0) return;
  await prisma.userBadge.deleteMany({ where: { badgeId: { in: ids } } });
  await prisma.badge.deleteMany({ where: { id: { in: ids } } });
}

/** Ligne de collection (user, variante, état) ou null. */
export async function getItem(userId: string, variantId: string, condition: string) {
  return prisma.collectionItem.findFirst({
    where: { userId, variantId, condition: condition as never },
  });
}

/** Nombre de lignes de collection d'un utilisateur (pour vérifier "base non modifiée"). */
export async function countItems(userId: string): Promise<number> {
  return prisma.collectionItem.count({ where: { userId } });
}
