import "server-only";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { syncAuth0User } from "@/server/user/auth-sync.service";
import { syncRolesFromAuth0 } from "@/server/auth/roles.service";
import { getPlatformConfig } from "@/server/platform/platform.service";

const viewerSelect = {
  id: true,
  displayName: true,
  slug: true,
  email: true,
  ratingAvg: true,
  reviewCount: true,
  role: true,
  staffRole: true,
} as const;

export type ViewerUser = Awaited<ReturnType<typeof getViewerUser>>;

/** Utilisateur Auth0 synchronisé avec Prisma — null si non connecté ou session invalide. */
export async function getAuthenticatedViewer() {
  let session;
  try {
    session = await auth0.getSession();
  } catch (err) {
    console.error("[auth] getSession failed — vérifie APP_BASE_URL vs l'URL du navigateur", err);
    return null;
  }
  if (!session?.user?.sub) return null;

  try {
    await syncAuth0User({
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
    });
    await syncRolesFromAuth0(session.user.sub, session.user as Record<string, unknown>);

    return prisma.user.findUnique({
      where: { auth0Id: session.user.sub },
      select: viewerSelect,
    });
  } catch (err) {
    console.error("[auth] syncAuth0User failed", err);
    return null;
  }
}

/**
 * Exige un utilisateur réellement connecté. Sinon, redirige vers la connexion Auth0
 * avec retour sur la page demandée. `returnTo` doit inclure le préfixe de langue
 * (ex. `/fr/boutique/panier`).
 */
export async function requireAuthViewer(returnTo: string) {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return viewer;
}

/** Connecté → compte réel ; sinon utilisateur démo si configuré en DB (null par défaut). */
export async function getViewerUser() {
  const authenticated = await getAuthenticatedViewer();
  if (authenticated) return authenticated;

  const { demoUserSlug } = await getPlatformConfig();
  if (!demoUserSlug) return null;

  return prisma.user.findFirst({
    where: { slug: demoUserSlug, status: "ACTIVE" },
    select: viewerSelect,
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
