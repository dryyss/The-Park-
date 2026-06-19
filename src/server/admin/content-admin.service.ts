import "server-only";
import { prisma } from "@/lib/prisma";
import { deleteCollectionPhotoFile } from "@/lib/collection-photo-storage";

export interface AdminPhotoRow {
  id: string;
  url: string;
  cardName: string;
  cardNumber: number;
  collectorName: string;
  collectorId: string;
  condition: string;
  reportCount: number;
  createdAt: Date;
}

export async function listAdminPhotos(input: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminPhotoRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input.pageSize ?? 24));
  const skip = (page - 1) * pageSize;

  const where = input.q?.trim()
    ? {
        collectionItem: {
          user: {
            OR: [
              { displayName: { contains: input.q.trim(), mode: "insensitive" as const } },
              { email: { contains: input.q.trim(), mode: "insensitive" as const } },
            ],
          },
        },
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.collectionItemPhoto.count({ where }),
    prisma.collectionItemPhoto.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        url: true,
        createdAt: true,
        collectionItem: {
          select: {
            condition: true,
            user: { select: { id: true, displayName: true } },
            variant: { select: { card: { select: { name: true, number: true } } } },
          },
        },
      },
    }),
  ]);

  const photoIds = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.collectionItem.user.id))];
  const reportCounts =
    userIds.length > 0
      ? await prisma.report.groupBy({
          by: ["targetId"],
          where: { targetType: "USER", targetId: { in: userIds }, status: { in: ["PENDING", "REVIEWING"] } },
          _count: { _all: true },
        })
      : [];
  const reportMap = new Map(reportCounts.map((r) => [r.targetId, r._count._all]));

  return {
    total,
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      url: r.url,
      cardName: r.collectionItem.variant.card.name,
      cardNumber: r.collectionItem.variant.card.number,
      collectorName: r.collectionItem.user.displayName,
      collectorId: r.collectionItem.user.id,
      condition: r.collectionItem.condition,
      reportCount: reportMap.get(r.collectionItem.user.id) ?? 0,
      createdAt: r.createdAt,
    })),
  };
}

export async function adminDeletePhoto(moderatorId: string, photoId: string): Promise<void> {
  const photo = await prisma.collectionItemPhoto.findUnique({
    where: { id: photoId },
    select: {
      url: true,
      collectionItem: { select: { userId: true } },
    },
  });
  if (!photo) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.collectionItemPhoto.delete({ where: { id: photoId } });
    await tx.moderationAction.create({
      data: {
        moderatorId,
        action: "PHOTO_REMOVED",
        targetType: "USER",
        targetId: photo.collectionItem.userId,
        details: { photoId },
      },
    });
  });

  await deleteCollectionPhotoFile(photo.url);
}

export async function getContentAdminStats() {
  const [totalPhotos, collectors, recentWeek] = await Promise.all([
    prisma.collectionItemPhoto.count(),
    prisma.collectionItemPhoto.groupBy({ by: ["collectionItemId"], _count: { _all: true } }),
    prisma.collectionItemPhoto.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);
  return { totalPhotos, uniqueItems: collectors.length, recentWeek };
}
