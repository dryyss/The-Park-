import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

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

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
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
