import "server-only";
import { prisma } from "@/lib/prisma";

export interface Auth0Profile {
  sub: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(base: string): Promise<string> {
  const normalized = base || "membre";
  let slug = normalized;
  let suffix = 0;
  while (await prisma.user.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${normalized}-${suffix}`;
  }
  return slug;
}

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

/** Crée ou met à jour l'utilisateur Prisma à partir de la session Auth0. */
export async function syncAuth0User(profile: Auth0Profile) {
  const now = new Date();
  const email = profile.email?.trim().toLowerCase();

  const byAuth0 = await prisma.user.findUnique({
    where: { auth0Id: profile.sub },
    select: { ...viewerSelect, displayNameCustom: true },
  });
  if (byAuth0) {
    await prisma.user.update({
      where: { id: byAuth0.id },
      data: {
        lastLoginAt: now,
        ...(profile.picture ? { avatarUrl: profile.picture } : {}),
        ...(email ? { email } : {}),
        ...(!byAuth0.displayNameCustom && profile.name ? { displayName: profile.name } : {}),
      },
    });
    return byAuth0;
  }

  if (email) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, auth0Id: true },
    });
    if (byEmail) {
      if (!byEmail.auth0Id || byEmail.auth0Id === profile.sub) {
        return prisma.user.update({
          where: { id: byEmail.id },
          data: {
            auth0Id: profile.sub,
            lastLoginAt: now,
            status: "ACTIVE",
            ...(profile.picture ? { avatarUrl: profile.picture } : {}),
            ...(profile.name ? { displayName: profile.name } : {}),
          },
          select: viewerSelect,
        });
      }
      throw new Error("EMAIL_ALREADY_LINKED");
    }
  }

  const displayName = profile.name?.trim() || email?.split("@")[0] || "Membre";
  const slugBase = slugify(displayName) || slugify(email?.split("@")[0] ?? "membre");
  const slug = await uniqueSlug(slugBase);

  return prisma.user.create({
    data: {
      auth0Id: profile.sub,
      email: email ?? `${slug}@auth.thepark.local`,
      displayName,
      slug,
      status: "ACTIVE",
      avatarUrl: profile.picture ?? null,
      lastLoginAt: now,
    },
    select: viewerSelect,
  });
}
