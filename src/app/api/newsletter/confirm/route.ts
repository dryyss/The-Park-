import { confirmNewsletter } from "@/server/newsletter/newsletter.service";
import { newsletterLandingPage } from "@/server/newsletter/newsletter-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lien de confirmation reçu par e-mail (double opt-in). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { ok, locale } = token
    ? await confirmNewsletter(token)
    : { ok: false, locale: "fr" };
  return newsletterLandingPage(ok ? "confirmed" : "invalid", locale);
}
