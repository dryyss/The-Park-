import "server-only";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

const DEMO_SLUG = "lighton-factory";

/** Utilisateur connecté (Prisma) ou membre démo pour le développement. */
export async function getViewerUser() {
  const session = await auth0.getSession();
  if (session?.user?.sub) {
    const linked = await prisma.user.findFirst({
      where: { auth0Id: session.user.sub },
      select: { id: true, displayName: true, slug: true, email: true, ratingAvg: true, reviewCount: true },
    });
    if (linked) return linked;
  }
  return prisma.user.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true, displayName: true, slug: true, email: true, ratingAvg: true, reviewCount: true },
  });
}

export async function getUserBySlug(slug: string) {
  return prisma.user.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      displayName: true,
      slug: true,
      bio: true,
      ratingAvg: true,
      reviewCount: true,
      collectionVisibility: true,
      createdAt: true,
    },
  });
}
