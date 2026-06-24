"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { acceptExchange, acceptExchangeWithItems, cancelExchange, proposeExchange, markExchangeAwaitingShipment } from "@/server/exchange/exchange.mutations";

export type ExchangeActionResult = { ok: true; exchangeId?: string } | { ok: false; error: string };

const proposeSchema = z.object({
  recipientSlug: z.string().min(1).max(64),
  giveVariantIds: z.array(z.string().min(1)).min(1).max(12),
  message: z.string().max(500).optional(),
  secured: z.boolean().optional(),
});

export async function proposeExchangeAction(input: unknown): Promise<ExchangeActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "VALIDATION" };

  try {
    const slug = parsed.data.recipientSlug.replace(/^\/+|\/+$/g, "").split("/").pop() ?? parsed.data.recipientSlug;
    const exchangeId = await proposeExchange(viewer.id, { ...parsed.data, recipientSlug: slug });
    revalidatePath("/echanges");
    return { ok: true, exchangeId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function acceptExchangeAction(exchangeId: string, giveVariantIds?: string[]): Promise<ExchangeActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    if (giveVariantIds && giveVariantIds.length > 0) {
      await acceptExchangeWithItems(viewer.id, exchangeId, giveVariantIds);
    } else {
      await acceptExchange(viewer.id, exchangeId);
    }
    revalidatePath("/echanges");
    revalidatePath("/securite", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function confirmExchangeAction(exchangeId: string): Promise<ExchangeActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await markExchangeAwaitingShipment(exchangeId, viewer.id);
    revalidatePath("/echanges");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}

export async function cancelExchangeAction(exchangeId: string): Promise<ExchangeActionResult> {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) return { ok: false, error: "UNAUTHORIZED" };

  try {
    await cancelExchange(viewer.id, exchangeId);
    revalidatePath("/echanges");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN" };
  }
}
