import "server-only";
import { prisma } from "@/lib/prisma";

export type SellerStepKey = "account" | "age" | "address" | "payout";

export interface SellerStep {
  key: SellerStepKey;
  done: boolean;
  /** Une étape requise bloque la publication d'une annonce tant qu'elle n'est pas validée. */
  required: boolean;
  /** Précision d'état pour l'UI (ex. mineur en attente de consentement). */
  state?: "pending-consent";
}

export interface SellerReadiness {
  ready: boolean;
  steps: SellerStep[];
  /** Adresses existantes (pour pré-remplir / afficher le compte). */
  addressCount: number;
  /** Date de naissance déjà connue (ISO yyyy-mm-dd) ou null. */
  birthDate: string | null;
}

function ageFrom(birthDate: Date, now: Date): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

/**
 * Étapes à valider sur le compte avant de pouvoir vendre.
 * Obligatoires : compte vérifié (ACTIVE), âge/protection mineurs, adresse d'expédition.
 * Recommandée (non bloquante pour l'instant) : compte de versement Stripe Connect.
 */
export async function getSellerReadiness(userId: string): Promise<SellerReadiness> {
  const [user, addressCount, consent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, birthDate: true, connectChargesEnabled: true, connectPayoutsEnabled: true },
    }),
    prisma.address.count({ where: { userId } }),
    prisma.parentalConsent.findUnique({ where: { userId }, select: { verifiedAt: true } }),
  ]);

  const now = new Date();

  const accountDone = user?.status === "ACTIVE";

  // Âge : majeur => OK ; mineur => consentement parental vérifié requis (CDC §5.2).
  let ageDone = false;
  let ageState: SellerStep["state"];
  if (user?.birthDate) {
    const age = ageFrom(user.birthDate, now);
    if (age >= 18) {
      ageDone = true;
    } else if (consent?.verifiedAt) {
      ageDone = true;
    } else {
      ageState = "pending-consent";
    }
  }

  const addressDone = addressCount > 0;
  const payoutDone = Boolean(user?.connectChargesEnabled && user?.connectPayoutsEnabled);

  const steps: SellerStep[] = [
    { key: "account", done: accountDone, required: true },
    { key: "age", done: ageDone, required: true, state: ageState },
    { key: "address", done: addressDone, required: true },
    { key: "payout", done: payoutDone, required: false },
  ];

  const ready = steps.every((s) => !s.required || s.done);

  return {
    ready,
    steps,
    addressCount,
    birthDate: user?.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
  };
}
