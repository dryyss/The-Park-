"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedViewer } from "@/server/user/user.service";

export type SellerActionError = "UNAUTHORIZED" | "VALIDATION" | "UNKNOWN";

export type SellerActionResult = { ok: true } | { ok: false; error: SellerActionError };

const birthDateSchema = z
  .object({
    // yyyy-mm-dd
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    guardianEmail: z.string().email().optional(),
  })
  .refine((d) => !Number.isNaN(Date.parse(d.birthDate)), { path: ["birthDate"] });

function ageFrom(birthDate: Date, now: Date): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/**
 * Enregistre la date de naissance. Si le membre est mineur, un email de tuteur est requis
 * et un consentement parental (non vérifié) est créé — la validation reste une étape distincte.
 */
export async function setBirthDateAction(input: unknown): Promise<SellerActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = birthDateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  const birthDate = new Date(`${parsed.data.birthDate}T00:00:00.000Z`);
  const now = new Date();
  const age = ageFrom(birthDate, now);
  if (age < 0 || age > 120) return { ok: false, error: "VALIDATION" };

  const isMinor = age < 18;
  if (isMinor && !parsed.data.guardianEmail) return { ok: false, error: "VALIDATION" };

  try {
    await prisma.user.update({ where: { id: viewer.id }, data: { birthDate } });

    if (isMinor && parsed.data.guardianEmail) {
      await prisma.parentalConsent.upsert({
        where: { userId: viewer.id },
        create: { userId: viewer.id, guardianEmail: parsed.data.guardianEmail, method: "email" },
        update: { guardianEmail: parsed.data.guardianEmail },
      });
    }

    revalidatePath("/[locale]/vendre", "page");
    return { ok: true };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  zip: z.string().trim().min(2).max(16),
  city: z.string().trim().min(1).max(80),
  country: z.string().trim().length(2).default("FR"),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
});

/** Ajoute une adresse d'expédition. La première adresse devient l'adresse par défaut. */
export async function addAddressAction(input: unknown): Promise<SellerActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const { fullName, line1, line2, zip, city, country, phone } = parsed.data;

  try {
    const existing = await prisma.address.count({ where: { userId: viewer.id } });
    await prisma.address.create({
      data: {
        userId: viewer.id,
        fullName,
        line1,
        line2: line2 || null,
        zip,
        city,
        country: country.toUpperCase(),
        phone: phone || null,
        isDefault: existing === 0,
      },
    });

    revalidatePath("/[locale]/vendre", "page");
    return { ok: true };
  } catch {
    return { ok: false, error: "UNKNOWN" };
  }
}
