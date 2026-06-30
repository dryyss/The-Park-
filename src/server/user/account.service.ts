import "server-only";
import { getUserAddresses, type UserAddress } from "@/server/user/address.service";
import { prisma } from "@/lib/prisma";
import type { Language } from "@/generated/prisma/client";

export interface AccountSettings {
  email: string;
  displayName: string;
  bio: string;
  slug: string;
  city: string;
  country: string;
  language: Language;
  addresses: UserAddress[];
  passwordResetUrl: string | null;
}

export async function getAccountSettings(userId: string): Promise<AccountSettings | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, bio: true, slug: true, city: true, country: true, language: true },
  });
  if (!user) return null;

  const addresses = await getUserAddresses(userId);

  const domain = process.env.AUTH0_DOMAIN?.trim();
  const clientId = process.env.AUTH0_CLIENT_ID?.trim();
  const passwordResetUrl =
    domain && clientId
      ? `https://${domain}/u/reset-password?client_id=${encodeURIComponent(clientId)}`
      : null;

  return {
    email: user.email,
    displayName: user.displayName,
    bio: user.bio ?? "",
    slug: user.slug,
    city: user.city ?? "",
    country: user.country ?? "",
    language: user.language,
    addresses,
    passwordResetUrl,
  };
}

/** Export RGPD — snapshot JSON des données personnelles du membre. */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      slug: true,
      bio: true,
      birthDate: true,
      role: true,
      notificationPrefs: true,
      createdAt: true,
      addresses: true,
      collectionItems: {
        select: { variantId: true, condition: true, quantity: true, acquiredAt: true },
      },
      wishlistItems: { select: { cardId: true, createdAt: true } },
      notifications: { take: 100, orderBy: { createdAt: "desc" }, select: { type: true, createdAt: true, readAt: true } },
    },
  });
  if (!user) throw new Error("NOT_FOUND");
  return { exportedAt: new Date().toISOString(), user };
}
