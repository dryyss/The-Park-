import "server-only";
import { getUserAddresses, type UserAddress } from "@/server/user/address.service";
import { prisma } from "@/lib/prisma";

export interface AccountSettings {
  email: string;
  displayName: string;
  bio: string;
  slug: string;
  addresses: UserAddress[];
  passwordResetUrl: string | null;
}

export async function getAccountSettings(userId: string): Promise<AccountSettings | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, bio: true, slug: true },
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
    addresses,
    passwordResetUrl,
  };
}
