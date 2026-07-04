import "server-only";
import { getAppBaseUrl } from "@/lib/env";

type LandingKind = "confirmed" | "unsubscribed" | "invalid";

const COPY: Record<string, Record<LandingKind, { title: string; body: string }>> = {
  fr: {
    confirmed: { title: "Inscription confirmée 🎉", body: "Tu recevras les drops et nouveautés de The Park." },
    unsubscribed: { title: "Désinscription effectuée", body: "Tu ne recevras plus la newsletter. À bientôt sur The Park." },
    invalid: { title: "Lien invalide ou expiré", body: "Ce lien n'est plus valide. Réessaie depuis le site." },
  },
  en: {
    confirmed: { title: "Subscription confirmed 🎉", body: "You'll receive The Park's drops and news." },
    unsubscribed: { title: "Unsubscribed", body: "You won't receive the newsletter anymore. See you on The Park." },
    invalid: { title: "Invalid or expired link", body: "This link is no longer valid. Please try again from the site." },
  },
  ja: {
    confirmed: { title: "登録が完了しました 🎉", body: "The Park のドロップやお知らせをお届けします。" },
    unsubscribed: { title: "配信を停止しました", body: "ニュースレターは今後届きません。またお会いしましょう。" },
    invalid: { title: "リンクが無効か期限切れです", body: "このリンクは無効です。サイトからやり直してください。" },
  },
};

const BACK_LABEL: Record<string, string> = { fr: "Retour à The Park", en: "Back to The Park", ja: "The Park に戻る" };

/** Page de retour auto-suffisante pour les liens e-mail (confirmation / désinscription). */
export function newsletterLandingPage(kind: LandingKind, locale: string): Response {
  const loc = COPY[locale] ? locale : "fr";
  const { title, body } = COPY[loc]![kind];
  const back = BACK_LABEL[loc]!;
  const home = `${getAppBaseUrl()}/${loc}`;

  const html = `<!doctype html><html lang="${loc}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — The Park</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#1b2021;color:#f5f2ea;display:grid;place-items:center;min-height:100vh}
  .card{max-width:420px;padding:40px 32px;text-align:center}
  .kicker{font-size:12px;letter-spacing:3px;color:#D6004F;text-transform:uppercase;font-weight:800}
  h1{font-size:22px;margin:16px 0 8px}
  p{color:#a8b4b1;font-size:14px;line-height:1.6}
  a{display:inline-block;margin-top:24px;background:#D6004F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;font-size:13px}
</style></head><body>
  <div class="card">
    <div class="kicker">The Park</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="${home}">${back}</a>
  </div>
</body></html>`;

  return new Response(html, {
    status: kind === "invalid" ? 400 : 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
