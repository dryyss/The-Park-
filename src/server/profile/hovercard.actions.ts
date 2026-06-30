"use server";

import { getUserHoverCard, type UserHoverCard } from "@/server/profile/profile.service";

/** Récupère le mini-profil d'un membre par slug (appelé à la volée au survol d'un pseudo). */
export async function fetchUserHoverCardAction(slug: string): Promise<UserHoverCard | null> {
  if (!slug || typeof slug !== "string") return null;
  return getUserHoverCard(slug);
}
