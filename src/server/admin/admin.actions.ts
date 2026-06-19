"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireModule } from "@/server/auth/admin-guard";
import { isOwner } from "@/server/auth/permissions.service";
import { adminModerateListing } from "@/server/admin/marketplace-admin.service";
import { adminCancelAuction } from "@/server/admin/auctions-admin.service";
import { adminAdjustWallet } from "@/server/admin/finance-admin.service";
import { adminDeletePhoto } from "@/server/admin/content-admin.service";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const listingActionSchema = z.object({
  listingId: z.string().min(1),
  action: z.enum(["PAUSE", "CANCEL", "ACTIVATE"]),
});

export async function adminModerateListingAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("marketplace");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = listingActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await adminModerateListing(access.user.id, parsed.data.listingId, parsed.data.action);
    revalidatePath("/admin/marketplace");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function adminCancelAuctionAction(auctionId: string): Promise<AdminActionResult> {
  const access = await requireModule("auctions");
  if (!access.ok) return { ok: false, error: access.reason };

  try {
    await adminCancelAuction(access.user.id, auctionId);
    revalidatePath("/admin/encheres");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

const walletAdjustSchema = z.object({
  userId: z.string().min(1),
  amountEur: z.number().refine((n) => n !== 0, "INVALID_AMOUNT"),
  target: z.enum(["deposit", "earned"]),
  note: z.string().min(3).max(200),
});

export async function adminAdjustWalletAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("finance");
  if (!access.ok) return { ok: false, error: access.reason };
  if (!isOwner(access.user)) return { ok: false, error: "FORBIDDEN" };

  const parsed = walletAdjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    await adminAdjustWallet({
      moderatorId: access.user.id,
      ...parsed.data,
    });
    revalidatePath("/admin/finances");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function adminDeletePhotoAction(photoId: string): Promise<AdminActionResult> {
  const access = await requireModule("content");
  if (!access.ok) return { ok: false, error: access.reason };

  try {
    await adminDeletePhoto(access.user.id, photoId);
    revalidatePath("/admin/contenu");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

const disputeResolveSchema = z.object({
  disputeId: z.string().min(1),
  verdict: z.enum(["FAVOR_CLAIMANT", "FAVOR_RESPONDENT", "SPLIT"]),
  captureDecision: z.enum(["FULL", "PARTIAL", "NONE", "REFUND"]),
  captureAmount: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export async function resolveDisputeArbitrationAction(input: unknown): Promise<AdminActionResult> {
  const access = await requireModule("moderation");
  if (!access.ok) return { ok: false, error: access.reason };

  const parsed = disputeResolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const { resolveDisputeWithArbitration } = await import("@/server/admin/disputes-admin.service");
    await resolveDisputeWithArbitration({
      moderatorId: access.user.id,
      ...parsed.data,
    });
    revalidatePath("/admin/moderation");
    revalidatePath(`/admin/moderation/litiges/${parsed.data.disputeId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
