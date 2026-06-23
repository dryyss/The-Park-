import "server-only";
import { prisma } from "@/lib/prisma";
import { deleteCollectionPhotoFile, saveCollectionPhotoFile } from "@/lib/collection-photo-storage";
import type { CardCondition } from "@/generated/prisma/client";

import { MAX_GRADED_PHOTOS_PER_KIND, MAX_PHOTOS_PER_ITEM } from "@/lib/collection-photos.constants";
import type { CollectionItemPhotoView, CommunityPhotoView, CollectionPhotoKind } from "@/server/collection/collection-photos.types";

export { MAX_PHOTOS_PER_ITEM, MAX_GRADED_PHOTOS_PER_KIND };
export type { CollectionItemPhotoView, CommunityPhotoView, CollectionPhotoKind };

async function getOwnedItem(userId: string, variantId: string, condition: CardCondition) {
  return prisma.collectionItem.findUnique({
    where: { userId_variantId_condition: { userId, variantId, condition } },
    select: { id: true, quantity: true, isGraded: true },
  });
}

export async function listItemPhotos(collectionItemId: string): Promise<CollectionItemPhotoView[]> {
  return prisma.collectionItemPhoto.findMany({
    where: { collectionItemId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, url: true, kind: true, sortOrder: true, createdAt: true },
  });
}

export async function listPhotosForViewerItem(
  userId: string,
  variantId: string,
  condition: CardCondition,
): Promise<{ collectionItemId: string | null; photos: CollectionItemPhotoView[] }> {
  const item = await getOwnedItem(userId, variantId, condition);
  if (!item || item.quantity <= 0) {
    return { collectionItemId: null, photos: [] };
  }
  const photos = await listItemPhotos(item.id);
  return { collectionItemId: item.id, photos };
}

export async function listCommunityPhotosForCard(cardId: string, limit = 24): Promise<CommunityPhotoView[]> {
  const rows = await prisma.collectionItemPhoto.findMany({
    where: {
      collectionItem: {
        quantity: { gt: 0 },
        variant: { cardId },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      url: true,
      kind: true,
      sortOrder: true,
      createdAt: true,
      collectionItem: {
        select: {
          condition: true,
          user: { select: { displayName: true, slug: true } },
          variant: { select: { versionType: { select: { label: true } } } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    kind: r.kind,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    collectorName: r.collectionItem.user.displayName,
    collectorSlug: r.collectionItem.user.slug,
    variantLabel: r.collectionItem.variant.versionType.label,
    condition: r.collectionItem.condition,
  }));
}

export async function uploadCollectionPhoto(
  userId: string,
  variantId: string,
  condition: CardCondition,
  file: File,
  kind: CollectionPhotoKind = "CARD",
): Promise<CollectionItemPhotoView> {
  const item = await getOwnedItem(userId, variantId, condition);
  if (!item || item.quantity <= 0) throw new Error("NOT_OWNED");

  if (kind === "CERTIFICATE" && !item.isGraded) throw new Error("NOT_GRADED");

  const count = await prisma.collectionItemPhoto.count({
    where: { collectionItemId: item.id, kind },
  });
  const maxForKind = item.isGraded ? MAX_GRADED_PHOTOS_PER_KIND : MAX_PHOTOS_PER_ITEM;
  if (count >= maxForKind) throw new Error("MAX_PHOTOS");

  const url = await saveCollectionPhotoFile(item.id, file);
  const photo = await prisma.collectionItemPhoto.create({
    data: { collectionItemId: item.id, url, kind, sortOrder: count },
    select: { id: true, url: true, kind: true, sortOrder: true, createdAt: true },
  });
  return photo;
}

export async function deleteCollectionPhoto(userId: string, photoId: string): Promise<void> {
  const photo = await prisma.collectionItemPhoto.findUnique({
    where: { id: photoId },
    select: {
      url: true,
      collectionItem: { select: { userId: true } },
    },
  });
  if (!photo || photo.collectionItem.userId !== userId) throw new Error("FORBIDDEN");

  await prisma.collectionItemPhoto.delete({ where: { id: photoId } });
  await deleteCollectionPhotoFile(photo.url);
}
