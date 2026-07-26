import "server-only";
import { Resend } from "resend";
import { getAppBaseUrl } from "@/lib/env";

let client: Resend | null = null;

/**
 * Version texte d'un e-mail HTML. Un message qui n'a qu'une partie HTML est un
 * marqueur de spam classique : les filtres attendent une alternative `text/plain`.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!isResendConfigured()) return false;

  const resend = getResendClient();
  if (!resend) return false;

  const from = process.env.RESEND_FROM_EMAIL!.trim();
  // Une adresse de réponse réelle : un `no-reply` sans Reply-To est pénalisé.
  const replyTo = process.env.RESEND_REPLY_TO?.trim();
  const unsubscribeUrl = `${getAppBaseUrl()}/parametres`;

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    // Alternative texte : exigée par la plupart des filtres anti-spam.
    text: htmlToText(input.html),
    ...(replyTo ? { replyTo } : {}),
    headers: {
      // Requis par Gmail/Yahoo pour les expéditeurs en volume depuis 2024.
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) {
    console.error("[resend] send failed", error);
    return false;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[resend] sent", data?.id, "→", input.to);
  }

  return true;
}
