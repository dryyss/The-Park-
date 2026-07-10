import "server-only";
import { prisma } from "@/lib/prisma";
import {
  SHOWCASE_MAX_BINDERS,
  SHOWCASE_TITLE_MAX,
  isSlotInBounds,
  normalizeShowcaseConfig,
  slotsPerPage,
} from "@/lib/showcase";

/** Codes d'erreur métier renvoyés aux actions (mappés vers l'i18n côté client). */
export class ShowcaseError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ShowcaseError";
  }
}

export function mapShowcaseError(err: unknown): string {
  if (err instanceof ShowcaseError) return err.code;
  return "UNKNOWN";
}

function cleanTitle(title: string | null | undefined): string | null {
  if (title == null) return null;
  const t = title.trim().slice(0, SHOWCASE_TITLE_MAX);
  return t.length > 0 ? t : null;
}

/** Charge un classeur en garantissant qu'il appartient au membre. */
async function requireOwnedShowcase(userId: string, showcaseId: string) {
  const showcase = await prisma.showcase.findFirst({ where: { id: showcaseId, userId } });
  if (!showcase) throw new ShowcaseError("NOT_FOUND");
  return showcase;
}

/** Crée un classeur (respecte le plafond de classeurs par membre). */
export async function createShowcase(
  userId: string,
  input: { title?: string | null; cols?: number; rows?: number; pageCount?: number },
) {
  const count = await prisma.showcase.count({ where: { userId } });
  if (count >= SHOWCASE_MAX_BINDERS) throw new ShowcaseError("LIMIT_REACHED");

  const config = normalizeShowcaseConfig(input);
  return prisma.showcase.create({
    data: {
      userId,
      title: cleanTitle(input.title),
      ...config,
      sortOrder: count,
    },
  });
}

/** Met à jour la config d'un classeur ; supprime les cartes devenues hors-grille si on rétrécit. */
export async function updateShowcaseConfig(
  userId: string,
  showcaseId: string,
  input: { title?: string | null; cols?: number; rows?: number; pageCount?: number },
) {
  const showcase = await requireOwnedShowcase(userId, showcaseId);
  const config = normalizeShowcaseConfig({
    cols: input.cols ?? showcase.cols,
    rows: input.rows ?? showcase.rows,
    pageCount: input.pageCount ?? showcase.pageCount,
  });
  const maxSlot = slotsPerPage(config.cols, config.rows);

  await prisma.$transaction(async (tx) => {
    // Purge des cartes hors des nouvelles bornes (page ou slot devenus invalides).
    await tx.showcaseItem.deleteMany({
      where: {
        showcaseId,
        OR: [{ page: { gte: config.pageCount } }, { slot: { gte: maxSlot } }],
      },
    });
    await tx.showcase.update({
      where: { id: showcaseId },
      data: {
        ...config,
        title: input.title === undefined ? undefined : cleanTitle(input.title),
      },
    });
  });
}

/** Supprime un classeur (cascade sur ses cartes). */
export async function deleteShowcase(userId: string, showcaseId: string) {
  await requireOwnedShowcase(userId, showcaseId);
  await prisma.showcase.delete({ where: { id: showcaseId } });
}

/** Réordonne les classeurs du membre selon la liste d'ids fournie. */
export async function reorderShowcases(userId: string, orderedIds: string[]) {
  const owned = await prisma.showcase.findMany({ where: { userId }, select: { id: true } });
  const ownedSet = new Set(owned.map((s) => s.id));
  if (orderedIds.length !== ownedSet.size || orderedIds.some((id) => !ownedSet.has(id))) {
    throw new ShowcaseError("INVALID_ORDER");
  }
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.showcase.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
}

/**
 * Place une carte possédée dans un emplacement (depuis la liste des cartes).
 * Si la carte est déjà dans le classeur, elle est déplacée. Si l'emplacement est
 * occupé par une autre carte, celle-ci est retirée (remplacement).
 */
export async function placeCard(
  userId: string,
  showcaseId: string,
  collectionItemId: string,
  page: number,
  slot: number,
) {
  const showcase = await requireOwnedShowcase(userId, showcaseId);
  if (!isSlotInBounds(page, slot, showcase.cols, showcase.rows, showcase.pageCount)) {
    throw new ShowcaseError("OUT_OF_BOUNDS");
  }
  const owns = await prisma.collectionItem.findFirst({
    where: { id: collectionItemId, userId },
    select: { id: true },
  });
  if (!owns) throw new ShowcaseError("NOT_OWNED");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.showcaseItem.findUnique({
      where: { showcaseId_collectionItemId: { showcaseId, collectionItemId } },
    });
    const occupant = await tx.showcaseItem.findUnique({
      where: { showcaseId_page_slot: { showcaseId, page, slot } },
    });

    // Emplacement occupé par une autre carte → on la retire (remplacement).
    if (occupant && occupant.id !== existing?.id) {
      await tx.showcaseItem.delete({ where: { id: occupant.id } });
    }
    if (existing) {
      await tx.showcaseItem.update({ where: { id: existing.id }, data: { page, slot } });
    } else {
      await tx.showcaseItem.create({ data: { showcaseId, collectionItemId, page, slot } });
    }
  });
}

/**
 * Déplace une carte déjà placée vers un autre emplacement (drag & drop).
 * Si la cible est occupée, les deux cartes sont échangées.
 */
export async function moveItem(
  userId: string,
  showcaseId: string,
  itemId: string,
  page: number,
  slot: number,
) {
  const showcase = await requireOwnedShowcase(userId, showcaseId);
  if (!isSlotInBounds(page, slot, showcase.cols, showcase.rows, showcase.pageCount)) {
    throw new ShowcaseError("OUT_OF_BOUNDS");
  }

  await prisma.$transaction(async (tx) => {
    const moving = await tx.showcaseItem.findFirst({ where: { id: itemId, showcaseId } });
    if (!moving) throw new ShowcaseError("NOT_FOUND");
    if (moving.page === page && moving.slot === slot) return; // no-op

    const target = await tx.showcaseItem.findUnique({
      where: { showcaseId_page_slot: { showcaseId, page, slot } },
    });
    const fromPage = moving.page;
    const fromSlot = moving.slot;

    // Parking temporaire hors grille pour éviter la collision d'unicité (showcaseId,page,slot).
    await tx.showcaseItem.update({ where: { id: moving.id }, data: { page: -1, slot: -1 } });
    if (target) {
      await tx.showcaseItem.update({ where: { id: target.id }, data: { page: fromPage, slot: fromSlot } });
    }
    await tx.showcaseItem.update({ where: { id: moving.id }, data: { page, slot } });
  });
}

/** Retire une carte d'un classeur. */
export async function removeItem(userId: string, showcaseId: string, itemId: string) {
  await requireOwnedShowcase(userId, showcaseId);
  await prisma.showcaseItem.deleteMany({ where: { id: itemId, showcaseId } });
}
