import { unsubscribeNewsletter } from "@/server/newsletter/newsletter.service";
import { newsletterLandingPage } from "@/server/newsletter/newsletter-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lien de désinscription reçu par e-mail. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const { ok, locale } = token
    ? await unsubscribeNewsletter(token)
    : { ok: false, locale: "fr" };
  return newsletterLandingPage(ok ? "unsubscribed" : "invalid", locale);
}
