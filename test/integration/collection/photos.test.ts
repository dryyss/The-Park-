import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listItemPhotos,
  listPhotosForViewerItem,
  listCommunityPhotosForCard,
  uploadCollectionPhoto,
  deleteCollectionPhoto,
  MAX_PHOTOS_PER_ITEM,
} from "@/server/collection/collection-photos.service";
import { qaTag, createTestUser, createTestCatalog, addToCollection, cleanupTag } from "../_helpers/fixtures";
import { cleanupTagBadges } from "./helpers";

const TAG = qaTag();

let owner: Awaited<ReturnType<typeof createTestUser>>;
let intruder: Awaited<ReturnType<typeof createTestUser>>;
let catalog: Awaited<ReturnType<typeof createTestCatalog>>;
let itemId: string;

/** Fichier factice — jamais écrit sur disque dans ces tests (les erreurs précèdent le stockage). */
const fakeFile = () => new File([new Uint8Array([1, 2, 3])], "qa.jpg", { type: "image/jpeg" });

/** Photo insérée directement en base (url hors /uploads/collection/ → suppression fichier no-op). */
async function createPhotoRow(collectionItemId: string, n: number, kind: "CARD" | "CERTIFICATE" = "CARD") {
  return prisma.collectionItemPhoto.create({
    data: { collectionItemId, url: `/qa-fake/${TAG}/${kind}-${n}.jpg`, kind, sortOrder: n },
  });
}

beforeAll(async () => {
  owner = await createTestUser(TAG, 1);
  intruder = await createTestUser(TAG, 2);
  catalog = await createTestCatalog(TAG, 2);
  const item = await addToCollection(owner.id, catalog.variants[0].id, { condition: "EXCELLENT" });
  itemId = item.id;
});

afterAll(async () => {
  await cleanupTagBadges(TAG);
  await cleanupTag(TAG);
});

describe(`photos de collection [${TAG}] — lectures`, () => {
  it("listItemPhotos retourne les photos triées par sortOrder", async () => {
    await createPhotoRow(itemId, 1);
    await createPhotoRow(itemId, 0);

    const photos = await listItemPhotos(itemId);
    expect(photos).toHaveLength(2);
    expect(photos.map((p) => p.sortOrder)).toEqual([0, 1]);
  });

  it("listPhotosForViewerItem : photos du propriétaire, vide pour un non-possesseur", async () => {
    const forOwner = await listPhotosForViewerItem(owner.id, catalog.variants[0].id, "EXCELLENT");
    expect(forOwner.collectionItemId).toBe(itemId);
    expect(forOwner.photos).toHaveLength(2);

    const forIntruder = await listPhotosForViewerItem(intruder.id, catalog.variants[0].id, "EXCELLENT");
    expect(forIntruder.collectionItemId).toBeNull();
    expect(forIntruder.photos).toEqual([]);
  });

  it("listCommunityPhotosForCard expose les photos avec les infos du collectionneur", async () => {
    const rows = await listCommunityPhotosForCard(catalog.cards[0].id);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const mine = rows.find((r) => r.collectorSlug === owner.slug);
    expect(mine).toBeDefined();
    expect(mine!.collectorName).toBe(owner.displayName);
    expect(mine!.condition).toBe("EXCELLENT");

    // Carte sans photo → vide.
    await expect(listCommunityPhotosForCard(catalog.cards[1].id)).resolves.toEqual([]);
  });
});

describe(`photos de collection [${TAG}] — gestion d'erreurs`, () => {
  it("upload sur un exemplaire non possédé → NOT_OWNED, aucune photo créée", async () => {
    const before = await prisma.collectionItemPhoto.count({ where: { collectionItemId: itemId } });
    await expect(
      uploadCollectionPhoto(intruder.id, catalog.variants[0].id, "EXCELLENT", fakeFile()),
    ).rejects.toThrow("NOT_OWNED");
    expect(await prisma.collectionItemPhoto.count({ where: { collectionItemId: itemId } })).toBe(before);
  });

  it("photo de certificat sur un exemplaire non gradé → NOT_GRADED", async () => {
    await expect(
      uploadCollectionPhoto(owner.id, catalog.variants[0].id, "EXCELLENT", fakeFile(), "CERTIFICATE"),
    ).rejects.toThrow("NOT_GRADED");
  });

  it("dépassement du quota de photos → MAX_PHOTOS, base intacte", async () => {
    const existing = await prisma.collectionItemPhoto.count({
      where: { collectionItemId: itemId, kind: "CARD" },
    });
    for (let n = existing; n < MAX_PHOTOS_PER_ITEM; n++) {
      await createPhotoRow(itemId, n);
    }

    await expect(
      uploadCollectionPhoto(owner.id, catalog.variants[0].id, "EXCELLENT", fakeFile()),
    ).rejects.toThrow("MAX_PHOTOS");
    expect(
      await prisma.collectionItemPhoto.count({ where: { collectionItemId: itemId, kind: "CARD" } }),
    ).toBe(MAX_PHOTOS_PER_ITEM);
  });

  it("suppression par un autre membre → FORBIDDEN, la photo reste ; le propriétaire peut supprimer", async () => {
    const photo = await prisma.collectionItemPhoto.findFirstOrThrow({
      where: { collectionItemId: itemId },
    });

    await expect(deleteCollectionPhoto(intruder.id, photo.id)).rejects.toThrow("FORBIDDEN");
    expect(await prisma.collectionItemPhoto.findUnique({ where: { id: photo.id } })).not.toBeNull();

    await deleteCollectionPhoto(owner.id, photo.id);
    expect(await prisma.collectionItemPhoto.findUnique({ where: { id: photo.id } })).toBeNull();
  });

  it("suppression d'une photo inexistante → FORBIDDEN", async () => {
    await expect(deleteCollectionPhoto(owner.id, `photo-inexistante-${TAG}`)).rejects.toThrow("FORBIDDEN");
  });
});
