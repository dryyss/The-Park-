/**
 * Diagnostic de délivrabilité des e-mails transactionnels.
 *
 * Contrôle SPF, DKIM et DMARC sur le domaine d'expédition : c'est la cause n°1
 * des messages classés en indésirables par Gmail et Outlook. Tout passe par des
 * résolutions DNS publiques — aucune clé API requise, aucun e-mail envoyé.
 *
 * Usage : pnpm mail:check
 */
import "dotenv/config";
import { resolveTxt } from "node:dns/promises";

const OK = "✅";
const KO = "❌";
const WARN = "⚠️";

/** Extrait le domaine d'un `From` de la forme "The Park <no-reply@the-park.fr>". */
function domainFromSender(from: string): string | null {
  const match = from.match(/<([^>]+)>/);
  const address = (match ? match[1] : from).trim();
  const at = address.lastIndexOf("@");
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

/** Enregistrements TXT d'un nom, aplatis (le DNS découpe au-delà de 255 caractères). */
async function txt(name: string): Promise<string[]> {
  try {
    return (await resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

let problems = 0;
function fail(message: string) {
  problems += 1;
  console.log(`${KO} ${message}`);
}

async function main() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!process.env.RESEND_API_KEY?.trim()) fail("RESEND_API_KEY absent — aucun e-mail ne part.");
  if (!from) {
    console.log(`${KO} RESEND_FROM_EMAIL absent — aucun e-mail ne part.`);
    process.exit(1);
  }

  const domain = domainFromSender(from);
  if (!domain) {
    console.log(`${KO} RESEND_FROM_EMAIL illisible : ${from}`);
    process.exit(1);
  }

  console.log(`Expéditeur : ${from}`);
  console.log(`Domaine    : ${domain}\n`);

  // --- SPF ---------------------------------------------------------------
  const rootSpf = (await txt(domain)).find((r) => r.toLowerCase().startsWith("v=spf1"));
  if (!rootSpf) {
    fail(`Aucun SPF sur ${domain}.`);
  } else {
    const authorizesResend = /amazonses\.com|resend\.com/i.test(rootSpf);
    console.log(`SPF ${domain} : ${rootSpf}`);
    if (authorizesResend) {
      console.log(`${OK} Le SPF racine autorise Resend.`);
    } else {
      // Resend expédie via Amazon SES. Tant que l'enveloppe part d'un sous-domaine
      // `send.`, SPF passe ; mais si Resend bascule sur le domaine racine, il casse.
      console.log(
        `${WARN} Le SPF racine n'autorise pas Resend (Amazon SES).\n` +
          `   → Ajouter include:amazonses.com : v=spf1 include:_spf-eu.ionos.com include:amazonses.com ~all`,
      );
    }
  }

  const subSpf = (await txt(`send.${domain}`)).find((r) => r.toLowerCase().startsWith("v=spf1"));
  if (subSpf) console.log(`${OK} SPF send.${domain} : ${subSpf}`);

  // --- DKIM --------------------------------------------------------------
  const dkim = await txt(`resend._domainkey.${domain}`);
  if (dkim.length && dkim.some((r) => r.includes("p="))) {
    console.log(`${OK} DKIM publié sur resend._domainkey.${domain} (signature alignée sur ${domain}).`);
  } else {
    fail(
      `Aucun DKIM sur resend._domainkey.${domain}.\n` +
        `   Sans DKIM aligné, DMARC échoue et les messages partent en indésirables.\n` +
        `   → Vérifier le domaine sur https://resend.com/domains et publier les DNS fournis.`,
    );
  }

  // --- DMARC -------------------------------------------------------------
  const dmarc = (await txt(`_dmarc.${domain}`)).find((r) => r.toLowerCase().includes("v=dmarc1"));
  if (!dmarc) {
    fail(
      `Aucun DMARC sur _dmarc.${domain}. Gmail et Yahoo l'exigent.\n` +
        `   → TXT _dmarc.${domain} : v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
    );
  } else {
    console.log(`DMARC : ${dmarc}`);
    if (!/rua=/i.test(dmarc)) {
      console.log(
        `${WARN} DMARC sans adresse de rapport (rua). Sans elle, aucun moyen de voir\n` +
          `   quels messages échouent ni pourquoi.\n` +
          `   → v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
      );
    } else {
      console.log(`${OK} DMARC complet.`);
    }
  }

  // --- En-têtes applicatifs ---------------------------------------------
  console.log("");
  if (process.env.RESEND_REPLY_TO?.trim()) {
    console.log(`${OK} Reply-To : ${process.env.RESEND_REPLY_TO.trim()}`);
  } else {
    console.log(
      `${WARN} RESEND_REPLY_TO non défini — un « no-reply » sans adresse de réponse\n` +
        `   est un signal négatif pour les filtres.`,
    );
  }

  console.log(
    problems === 0
      ? `\n${OK} Aucun défaut bloquant. Les messages encore classés en spam relèvent de la\n` +
          `   réputation d'envoi, qui se construit avec le volume et l'engagement.`
      : `\n${KO} ${problems} défaut(s) bloquant(s) à corriger côté DNS.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
