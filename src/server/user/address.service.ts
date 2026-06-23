import "server-only";
import { prisma } from "@/lib/prisma";

export interface UserAddress {
  id: string;
  label: string | null;
  fullName: string;
  line1: string;
  line2: string | null;
  zip: string;
  city: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

export async function getUserAddresses(userId: string): Promise<UserAddress[]> {
  const rows = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    label: a.label,
    fullName: a.fullName,
    line1: a.line1,
    line2: a.line2,
    zip: a.zip,
    city: a.city,
    country: a.country,
    phone: a.phone,
    isDefault: a.isDefault,
  }));
}

export async function upsertUserAddress(
  userId: string,
  input: {
    id?: string;
    label?: string;
    fullName: string;
    line1: string;
    line2?: string;
    zip: string;
    city: string;
    country?: string;
    phone?: string;
    isDefault?: boolean;
  },
): Promise<string> {
  const data = {
    label: input.label ?? null,
    fullName: input.fullName.trim(),
    line1: input.line1.trim(),
    line2: input.line2?.trim() || null,
    zip: input.zip.trim(),
    city: input.city.trim(),
    country: input.country?.trim() || "FR",
    phone: input.phone?.trim() || null,
    isDefault: input.isDefault ?? false,
  };

  if (input.isDefault) {
    await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  }

  if (input.id) {
    const existing = await prisma.address.findFirst({ where: { id: input.id, userId } });
    if (!existing) throw new Error("NOT_FOUND");
    await prisma.address.update({ where: { id: input.id }, data });
    return input.id;
  }

  const created = await prisma.address.create({ data: { ...data, userId } });
  return created.id;
}

export async function deleteUserAddress(userId: string, addressId: string): Promise<void> {
  const existing = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!existing) throw new Error("NOT_FOUND");
  await prisma.address.delete({ where: { id: addressId } });
}

export async function updateUserProfile(
  userId: string,
  data: { displayName?: string; bio?: string; slug?: string; city?: string },
): Promise<void> {
  if (data.slug) {
    const taken = await prisma.user.findFirst({
      where: { slug: data.slug, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw new Error("SLUG_TAKEN");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.displayName !== undefined
        ? { displayName: data.displayName.trim(), displayNameCustom: true }
        : {}),
      ...(data.bio !== undefined ? { bio: data.bio.trim() || null } : {}),
      ...(data.slug !== undefined ? { slug: data.slug.trim() } : {}),
      ...(data.city !== undefined ? { city: data.city.trim() || null } : {}),
    },
  });
}
