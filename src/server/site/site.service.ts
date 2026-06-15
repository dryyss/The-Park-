import "server-only";
import { prisma } from "@/lib/prisma";

export interface DropEvent {
  name: string;
  targetDate: Date;
}

export interface LockedSeason {
  code: string;
  name: string;
  releaseDate: Date | null;
}

/** Prochain drop depuis un produit LIMITED_EDITION actif avec releaseDate future. */
export async function getNextDropEvent(): Promise<DropEvent | null> {
  const product = await prisma.product.findFirst({
    where: {
      active: true,
      type: "LIMITED_EDITION",
      releaseDate: { gt: new Date() },
    },
    orderBy: { releaseDate: "asc" },
  });
  if (!product?.releaseDate) return null;
  return { name: product.name, targetDate: product.releaseDate };
}

/** Saison verrouillée (releaseDate future ou sans cartes). */
export async function getLockedSeason(code = "S02"): Promise<LockedSeason | null> {
  const season = await prisma.season.findUnique({
    where: { code },
    include: { _count: { select: { cards: true } } },
  });
  if (!season) return null;
  if (season._count.cards > 0 && (!season.releaseDate || season.releaseDate <= new Date())) {
    return null;
  }
  return { code: season.code, name: season.name, releaseDate: season.releaseDate };
}
