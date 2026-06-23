"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { deleteUserAddress, updateUserProfile, upsertUserAddress } from "@/server/user/address.service";

export type ProfileActionResult = { ok: true; addressId?: string } | { ok: false; error: string };

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().max(40).optional(),
  fullName: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  zip: z.string().min(2).max(16),
  city: z.string().min(1).max(80),
  country: z.string().length(2).optional(),
  phone: z.string().max(32).optional(),
  isDefault: z.boolean().optional(),
});

const profileSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
  city: z.string().max(100).optional(),
});

export async function saveAddressAction(input: unknown): Promise<ProfileActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const addressId = await upsertUserAddress(viewer.id, parsed.data);
    revalidatePath("/profil");
    revalidatePath("/parametres");
    revalidatePath("/vendre");
    return { ok: true, addressId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function deleteAddressAction(addressId: string): Promise<ProfileActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await deleteUserAddress(viewer.id, addressId);
    revalidatePath("/profil");
    revalidatePath("/parametres");
    revalidatePath("/vendre");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function updateProfileAction(input: unknown): Promise<ProfileActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await updateUserProfile(viewer.id, parsed.data);
    revalidatePath("/profil");
    revalidatePath("/parametres");
    revalidatePath("/vendre");
    revalidatePath("/collectionneur/[slug]", "page");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
