import "server-only";
import { prisma } from "@/lib/prisma";
import { rarityMeta, cardImage, cardNumberLabel } from "@/lib/rarity";

/** Carte résolue pour l'affichage dans un emplacement de classeur. */
export interface ShowcaseCardView {
  itemId: string;
  collectionItemId: string;
  page: number;
  slot: number;
  name: string;
  slug: string;
  image: string | null;
  color: string;
  glyph: string;
  numberLabel: string;
}

/** Un classeur complet (public ou éditeur). */
export interface ShowcaseView {
  id: string;
  title: string | null;
  cols: number;
  rows: number;
  pageCount: number;
  items: ShowcaseCardView[];
}

/** Carte possédée sélectionnable dans l'éditeur (un exemplaire = un CollectionItem). */
export interface PlaceableCard {
  collectionItemId: string;
  name: string;
  slug: string;
  image: string | null;
  color: string;
  glyph: string;
  numberLabel: string;
  condition: string;
}

const cardInclude = {
  variant: { include: { card: { include: { rarity: true, season: true } } } },
} as const;

interface CardForView {
  name: string;
  slug: string;
  number: number;
  imageUrl: string | null;
  rarity: { code: string; color: string | null; symbol: string | null };
  season: { code: string };
}

function resolveCard(variantImage: string | null, card: CardForView) {
  const meta = rarityMeta(card.rarity.code);
  const imageFile = card.imageUrl ?? variantImage ?? null;
  return {
    name: card.name,
    slug: card.slug,
    image: imageFile ? cardImage(imageFile) : null,
    color: card.rarity.color ?? meta.color,
    glyph: card.rarity.symbol ?? meta.glyph,
    numberLabel: cardNumberLabel(card.number, card.rarity.code, card.season.code),
  };
}

/** Classeurs d'un membre (ordonnés), avec cartes résolues. Utilisé par le profil public et l'éditeur. */
export async function getShowcases(userId: string): Promise<ShowcaseView[]> {
  const showcases = await prisma.showcase.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        orderBy: [{ page: "asc" }, { slot: "asc" }],
        include: { collectionItem: { include: cardInclude } },
      },
    },
  });

  return showcases.map((s) => ({
    id: s.id,
    title: s.title,
    cols: s.cols,
    rows: s.rows,
    pageCount: s.pageCount,
    items: s.items
      // Un CollectionItem supprimé casse l'item via cascade ; garde défensive au cas où.
      .filter((it) => it.collectionItem != null)
      .map((it) => ({
        itemId: it.id,
        collectionItemId: it.collectionItemId,
        page: it.page,
        slot: it.slot,
        ...resolveCard(it.collectionItem.variant.imageUrl, it.collectionItem.variant.card),
      })),
  }));
}

/** Cartes possédées (exemplaires) que le membre peut placer dans un classeur. */
export async function getPlaceableCards(userId: string): Promise<PlaceableCard[]> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    include: cardInclude,
  });

  return items
    .map((it) => ({
      collectionItemId: it.id,
      condition: it.condition,
      ...resolveCard(it.variant.imageUrl, it.variant.card),
    }))
    .sort((a, b) => a.numberLabel.localeCompare(b.numberLabel, "fr", { numeric: true }));
}

/** Données complètes de l'éditeur : classeurs du membre + cartes plaçables. */
export async function getShowcaseEditorData(userId: string): Promise<{
  showcases: ShowcaseView[];
  placeable: PlaceableCard[];
}> {
  const [showcases, placeable] = await Promise.all([
    getShowcases(userId),
    getPlaceableCards(userId),
  ]);
  return { showcases, placeable };
}
