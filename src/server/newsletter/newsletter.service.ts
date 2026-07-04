import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/env";
import { sendTransactionalEmail, isResendConfigured } from "@/lib/resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_LOCALES = ["fr", "en", "ja"];

export type NewsletterResult = "CONFIRMATION_SENT" | "ALREADY_CONFIRMED" | "CONFIRMED_DIRECT";

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function normalizeLocale(locale: string): string {
  return SUPPORTED_LOCALES.includes(locale) ? locale : "fr";
}

const CONFIRM_COPY: Record<string, { subject: string; intro: string; cta: string; ignore: string }> = {
  fr: {
    subject: "Confirme ton inscription — The Park",
    intro: "Merci de ton intérêt pour The Park. Confirme ton adresse pour recevoir les drops, nouveautés et temps forts.",
    cta: "Confirmer mon inscription",
    ignore: "Si tu n'es pas à l'origine de cette demande, ignore simplement cet e-mail.",
  },
  en: {
    subject: "Confirm your subscription — The Park",
    intro: "Thanks for your interest in The Park. Confirm your address to receive drops, news and highlights.",
    cta: "Confirm my subscription",
    ignore: "If you didn't request this, just ignore this email.",
  },
  ja: {
    subject: "登録の確認 — The Park",
    intro: "The Park にご関心をお寄せいただきありがとうございます。ドロップやお知らせを受け取るにはアドレスを確認してください。",
    cta: "登録を確認する",
    ignore: "心当たりがない場合は、このメールを無視してください。",
  },
};

async function sendConfirmationEmail(email: string, token: string, locale: string): Promise<boolean> {
  const copy = CONFIRM_COPY[locale] ?? CONFIRM_COPY.fr!;
  const url = `${getAppBaseUrl()}/api/newsletter/confirm?token=${token}`;
  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1E2424">
    <p style="font-size:12px;letter-spacing:2px;color:#D6004F;text-transform:uppercase">The Park</p>
    <p>${copy.intro}</p>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#D6004F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700">${copy.cta}</a>
    </p>
    <p style="font-size:11px;color:#888">${copy.ignore}</p>
  </div>`;
  return sendTransactionalEmail({ to: email, subject: copy.subject, html });
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
    select: { id: true, status: true, locale: true },
  });
  if (!sub) return { ok: false, locale: "fr" };
  if (sub.status !== "CONFIRMED") {
    await prisma.newsletterSubscription.update({
      where: { id: sub.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
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
