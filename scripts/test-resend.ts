import "dotenv/config";
import { Resend } from "resend";

async function main() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.error("RESEND_API_KEY et RESEND_FROM_EMAIL requis dans .env");
    process.exit(1);
  }

  const to = process.argv[2] ?? "theparktcg@gmail.com";
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "The Park — test Resend",
    html: "<p>Resend est branché sur <strong>The Park</strong>.</p>",
  });

  if (error) {
    console.error("❌", error);
    process.exit(1);
  }

  console.log(`✅ E-mail envoyé à ${to} (id: ${data?.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
