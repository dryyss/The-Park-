import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/env";
import { sendTransactionalEmail, isResendConfigured } from "@/lib/resend";
import {
  buildNewsletterConfirmEmail,
  buildNewsletterWelcomeEmail,
} from "@/server/notification/transactional-emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_LOCALES = ["fr", "en", "ja"];

export type NewsletterResult = "CONFIRMATION_SENT" | "ALREADY_CONFIRMED" | "CONFIRMED_DIRECT";

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeLocale(locale: string): string {
  return SUPPORTED_LOCALES.includes(locale) ? locale : "fr";
}

async function sendConfirmationEmail(email: string, token: string, locale: string): Promise<boolean> {
  const confirmUrl = `${getAppBaseUrl()}/api/newsletter/confirm?token=${token}`;
  const { subject, html } = buildNewsletterConfirmEmail({ confirmUrl, locale });
  return sendTransactionalEmail({ to: email, subject, html });
}

/**
 * Inscription newsletter en **double opt-in** (RGPD) : on crée/rafraîchit un
 * abonnement PENDING et on envoie un e-mail de confirmation. Si Resend n'est pas
 * configuré (dev/démo), on bascule en opt-in simple pour ne pas bloquer le parcours.
 */
export async function subscribeToNewsletter(
  rawEmail: string,
  locale: string,
  source = "footer",
): Promise<NewsletterResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new Error("INVALID_EMAIL");
  const loc = normalizeLocale(locale);

  const existing = await prisma.newsletterSubscription.findUnique({
    where: { email },
    select: { status: true },
  });
  if (existing?.status === "CONFIRMED") return "ALREADY_CONFIRMED";

  const token = newToken();
  const resendOk = isResendConfigured();
  const status = resendOk ? "PENDING" : "CONFIRMED";

  await prisma.newsletterSubscription.upsert({
    where: { email },
    create: { email, token, locale: loc, source, status, confirmedAt: resendOk ? null : new Date() },
    update: { token, locale: loc, status, confirmedAt: resendOk ? null : new Date() },
  });

  if (!resendOk) {
    console.info("[newsletter] Resend non configuré — opt-in simple", email);
    return "CONFIRMED_DIRECT";
  }

  await sendConfirmationEmail(email, token, loc);
  return "CONFIRMATION_SENT";
}

/** Confirme un abonnement (lien e-mail). Retourne la locale pour la page de retour. */
export async function confirmNewsletter(token: string): Promise<{ ok: boolean; locale: string }> {
  const sub = await prisma.newsletterSubscription.findUnique({
    where: { token },
    select: { id: true, email: true, status: true, locale: true },
  });
  if (!sub) return { ok: false, locale: "fr" };
  if (sub.status !== "CONFIRMED") {
    await prisma.newsletterSubscription.update({
      where: { id: sub.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    // Bienvenue — best-effort : l'inscription reste valide même si l'envoi échoue.
    const { subject, html } = buildNewsletterWelcomeEmail({
      locale: sub.locale,
      unsubscribeUrl: `${getAppBaseUrl()}/api/newsletter/unsubscribe?token=${token}`,
    });
    await sendTransactionalEmail({ to: sub.email, subject, html }).catch((err) =>
      console.error("[newsletter] welcome email failed", err),
    );
  }
  return { ok: true, locale: sub.locale };
}

/** Désinscription (lien e-mail). */
export async function unsubscribeNewsletter(token: string): Promise<{ ok: boolean; locale: string }> {
  const sub = await prisma.newsletterSubscription.findUnique({
    where: { token },
    select: { id: true, locale: true },
  });
  if (!sub) return { ok: false, locale: "fr" };
  await prisma.newsletterSubscription.update({
    where: { id: sub.id },
    data: { status: "UNSUBSCRIBED" },
  });
  return { ok: true, locale: sub.locale };
}
