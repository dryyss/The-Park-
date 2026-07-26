import "server-only";
import { getAppBaseUrl } from "@/lib/env";

/**
 * Design system e-mail — The Park.
 *
 * Tout e-mail transactionnel passe par `renderEmail()` : même en-tête (logo),
 * même charte sombre, même pied de page. Le HTML est en tables + styles inline,
 * seul format fiable sur Gmail / Outlook / Apple Mail (pas de flex, pas de grid,
 * pas de <style> externe).
 */

export const EMAIL_BRAND = {
  name: "The Park",
  tagline: "DRIFT / JDM CULTURE",
  /** Logo servi en absolu depuis /public (les clients mail ne résolvent pas les URLs relatives). */
  logoPath: "/icon-192.png",
} as const;

/** Palette e-mail — miroir des tokens `@theme` de globals.css. */
const C = {
  bg: "#0e0e11",
  panel: "#16161a",
  panelAlt: "#1f1f24",
  border: "#26262b",
  text: "#f2efe9",
  body: "#a9a9b2",
  muted: "#6e6e78",
  carmin: "#d81b60",
  or: "#e8b23a",
  vert: "#5ed99a",
  orange: "#ff9f43",
  rouge: "#ff3b5c",
  bleu: "#4fa3ff",
  violet: "#b05cff",
} as const;

const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_DISPLAY = "'Arial Black','Arial Bold',Gadget,sans-serif";

/** Accent de l'e-mail : bandeau, boutons, filets des panneaux. */
export type EmailTone = "brand" | "gold" | "success" | "warning" | "danger" | "trade" | "badge";

const TONE_COLOR: Record<EmailTone, string> = {
  brand: C.carmin,
  gold: C.or,
  success: C.vert,
  warning: C.orange,
  danger: C.rouge,
  trade: C.bleu,
  badge: C.violet,
};

/** Texte des boutons : lisible sur fond clair (or/vert) comme sur fond saturé. */
const TONE_ON_COLOR: Record<EmailTone, string> = {
  brand: "#ffffff",
  gold: "#1a1a1e",
  success: "#12241a",
  warning: "#2a1a0d",
  danger: "#ffffff",
  trade: "#0b1c2e",
  badge: "#ffffff",
};

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** Échappe une donnée dynamique avant injection dans le HTML. */
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Valeur mise en avant dans une phrase. */
export function b(value: unknown): string {
  return `<strong style="color:${C.text}">${esc(value)}</strong>`;
}

/** URL absolue vers l'app, préfixée par la locale du destinataire. */
export function appUrl(path: string, locale = "fr"): string {
  const base = getAppBaseUrl();
  if (!path || path === "/") return `${base}/${locale}`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}/${locale}${clean}`;
}

/** Lit une chaîne non vide dans un payload de notification. */
export function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Montant en euros, quel que soit le format d'entrée ("19.90", 19.9, "19,90 €"). */
export function money(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).replace(/\s|€/g, "").replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return typeof value === "string" && value.trim() ? value.trim() : null;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

/** Date longue française : « 25 juillet 2026 à 21:11 ». */
export function dateLabel(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ---------------------------------------------------------------------------
//  Blocs de contenu (retournent du HTML prêt à insérer dans `blocks`)
// ---------------------------------------------------------------------------

/** Encadré mis en avant, filet coloré à gauche. */
export function blockPanel(innerHtml: string, tone: EmailTone = "brand"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
    <tr>
      <td style="background:${C.panelAlt};border-left:3px solid ${TONE_COLOR[tone]};border-radius:0 12px 12px 0;padding:16px 18px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.body}">
        ${innerHtml}
      </td>
    </tr>
  </table>`;
}

/** Liste label / valeur (récap commande, coordonnées, caractéristiques). */
export function blockData(rows: { label: string; value: string; tone?: EmailTone }[]): string {
  const body = rows
    .filter((r) => r.value)
    .map(
      (r, i) => `<tr>
        <td style="padding:${i === 0 ? "0" : "10px"} 12px 10px 0;font-family:${FONT};font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted};white-space:nowrap;vertical-align:top">${esc(r.label)}</td>
        <td style="padding:${i === 0 ? "0" : "10px"} 0 10px 0;font-family:${FONT};font-size:14px;color:${r.tone ? TONE_COLOR[r.tone] : C.text};text-align:right;vertical-align:top">${r.value}</td>
      </tr>`,
    )
    .join("");
  if (!body) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:${C.panelAlt};border-radius:12px">
    <tr><td style="padding:16px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr>
  </table>`;
}

/** Montant héroïque (paiement, gain, remboursement). */
export function blockAmount(amount: string, caption?: string, tone: EmailTone = "gold"): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
    <tr><td align="center" style="background:${C.panelAlt};border-radius:14px;padding:22px 18px">
      <div style="font-family:${FONT_DISPLAY};font-size:30px;letter-spacing:-0.5px;color:${TONE_COLOR[tone]}">${esc(amount)}</div>
      ${caption ? `<div style="margin-top:6px;font-family:${FONT};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted}">${esc(caption)}</div>` : ""}
    </td></tr>
  </table>`;
}

/** Code à copier : n° de suivi, code de parrainage, référence. */
export function blockCode(value: string, caption?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
    <tr><td align="center" style="background:${C.panelAlt};border:1px dashed ${C.border};border-radius:12px;padding:18px">
      ${caption ? `<div style="margin-bottom:8px;font-family:${FONT};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted}">${esc(caption)}</div>` : ""}
      <div style="font-family:'Courier New',Courier,monospace;font-size:19px;letter-spacing:2px;color:${C.text}">${esc(value)}</div>
    </td></tr>
  </table>`;
}

/** Lignes d'articles + total (commande, facture, panier). */
export function blockItems(
  items: { label: string; sub?: string; right: string }[],
  total?: { label: string; value: string },
): string {
  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:12px 12px 12px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.text}">
          ${esc(it.label)}
          ${it.sub ? `<div style="margin-top:3px;font-family:${FONT};font-size:11px;color:${C.muted}">${esc(it.sub)}</div>` : ""}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;color:${C.text};text-align:right;white-space:nowrap;vertical-align:top">${esc(it.right)}</td>
      </tr>`,
    )
    .join("");
  const totalRow = total
    ? `<tr>
        <td style="padding:14px 12px 0 0;font-family:${FONT};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted}">${esc(total.label)}</td>
        <td style="padding:14px 0 0 0;font-family:${FONT_DISPLAY};font-size:18px;color:${C.or};text-align:right;white-space:nowrap">${esc(total.value)}</td>
      </tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">${rows}${totalRow}</table>`;
}

/** Carte mise en avant : visuel + nom + méta + valeur à droite. */
export function blockCardItem(input: {
  name: string;
  sub?: string | null;
  image?: string | null;
  right?: string | null;
}): string {
  const img = input.image
    ? `<td width="76" style="padding-right:14px;vertical-align:top">
         <img src="${encodeURI(input.image)}" width="76" alt="" style="display:block;width:76px;border-radius:8px;border:1px solid ${C.border}" />
       </td>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:${C.panelAlt};border-radius:14px">
    <tr><td style="padding:16px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${img}
        <td style="vertical-align:middle">
          <div style="font-family:${FONT};font-size:15px;font-weight:bold;color:${C.text}">${esc(input.name)}</div>
          ${input.sub ? `<div style="margin-top:4px;font-family:${FONT};font-size:12px;color:${C.muted}">${esc(input.sub)}</div>` : ""}
        </td>
        ${input.right ? `<td style="vertical-align:middle;text-align:right;font-family:${FONT_DISPLAY};font-size:17px;color:${C.or};white-space:nowrap">${esc(input.right)}</td>` : ""}
      </tr></table>
    </td></tr>
  </table>`;
}

/** Citation : aperçu de message, motif de litige, commentaire d'avis. */
export function blockQuote(text: string, author?: string | null): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
    <tr><td style="background:${C.panelAlt};border-radius:12px;padding:16px 18px">
      ${author ? `<div style="margin-bottom:8px;font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.muted}">${esc(author)}</div>` : ""}
      <div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${C.body};font-style:italic">« ${esc(text)} »</div>
    </td></tr>
  </table>`;
}

/** Étapes suivantes, numérotées. */
export function blockSteps(steps: string[]): string {
  const rows = steps
    .map(
      (s, i) => `<tr>
        <td width="26" style="padding:6px 12px 6px 0;font-family:${FONT_DISPLAY};font-size:13px;color:${C.carmin};vertical-align:top">${i + 1}.</td>
        <td style="padding:6px 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.body}">${s}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">${rows}</table>`;
}

// ---------------------------------------------------------------------------
//  Shell
// ---------------------------------------------------------------------------

export interface RenderEmailInput {
  /** Rubrique affichée au-dessus du titre : « Boutique », « Marketplace »… */
  eyebrow: string;
  title: string;
  /** Texte d'aperçu dans la boîte de réception (masqué dans le corps). */
  preheader: string;
  /** Prénom / pseudo du destinataire — « Salut Kenji, ». */
  recipientName?: string | null;
  /** Paragraphes : HTML autorisé, les données dynamiques doivent passer par esc()/b(). */
  body: string[];
  /** Blocs générés par les helpers `block*`. */
  blocks?: string[];
  cta?: { label: string; url: string } | null;
  secondary?: { label: string; url: string } | null;
  /** Précision en petit sous les boutons (délai, condition, rappel). */
  footerNote?: string | null;
  tone?: EmailTone;
  locale?: string;
  /** `false` pour les e-mails légaux/obligatoires (factures) : pas de mention de désinscription. */
  showPrefsLink?: boolean;
  /** Remplace la phrase « Tu reçois cet e-mail parce que… » (newsletter, autre langue). */
  prefsNote?: string | null;
}

function ctaButton(cta: { label: string; url: string }, tone: EmailTone): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto">
    <tr><td align="center" bgcolor="${TONE_COLOR[tone]}" style="border-radius:10px">
      <a href="${encodeURI(cta.url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:${TONE_ON_COLOR[tone]};text-decoration:none;border-radius:10px">${esc(cta.label)}</a>
    </td></tr>
  </table>`;
}

/** Assemble un e-mail complet aux couleurs de The Park. */
export function renderEmail(input: RenderEmailInput): string {
  const tone = input.tone ?? "brand";
  const locale = input.locale ?? "fr";
  const accent = TONE_COLOR[tone];
  const base = getAppBaseUrl();
  const home = appUrl("/", locale);

  const paragraphs = input.body
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body}">${p}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>${esc(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.panel};border:1px solid ${C.border};border-radius:18px;overflow:hidden">

      <!-- Bandeau d'accent -->
      <tr><td bgcolor="${accent}" style="height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>

      <!-- En-tête : logo + wordmark -->
      <tr><td style="padding:24px 28px 8px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="52" style="vertical-align:middle;padding-right:14px">
            <a href="${encodeURI(home)}"><img src="${encodeURI(base + EMAIL_BRAND.logoPath)}" width="52" height="52" alt="${esc(EMAIL_BRAND.name)}" style="display:block;width:52px;height:52px;border:0" /></a>
          </td>
          <td style="vertical-align:middle">
            <div style="font-family:${FONT_DISPLAY};font-size:18px;letter-spacing:2.5px;color:${C.text}">THE PARK</div>
            <div style="margin-top:3px;font-family:${FONT};font-size:9px;letter-spacing:2px;color:${C.muted}">${esc(EMAIL_BRAND.tagline)}</div>
          </td>
        </tr></table>
      </td></tr>

      <!-- Corps -->
      <tr><td style="padding:20px 28px 8px 28px">
        <div style="font-family:${FONT};font-size:10px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${accent}">${esc(input.eyebrow)}</div>
        <h1 style="margin:10px 0 18px 0;font-family:${FONT_DISPLAY};font-size:23px;line-height:1.25;color:${C.text}">${esc(input.title)}</h1>
        ${input.recipientName ? `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.body}">Salut ${esc(input.recipientName)},</p>` : ""}
        ${paragraphs}
        ${(input.blocks ?? []).filter(Boolean).join("")}
      </td></tr>

      ${
        input.cta
          ? `<tr><td align="center" style="padding:12px 28px 4px 28px">
              ${ctaButton(input.cta, tone)}
            </td></tr>`
          : ""
      }
      ${
        input.secondary
          ? `<tr><td align="center" style="padding:14px 28px 0 28px">
              <a href="${encodeURI(input.secondary.url)}" style="font-family:${FONT};font-size:12px;color:${C.muted};text-decoration:underline">${esc(input.secondary.label)}</a>
            </td></tr>`
          : ""
      }
      ${
        input.footerNote
          ? `<tr><td style="padding:16px 28px 0 28px">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">${input.footerNote}</p>
            </td></tr>`
          : ""
      }

      <!-- Pied de page -->
      <tr><td style="padding:26px 28px 24px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid ${C.border};padding-top:18px">
            <p style="margin:0 0 8px 0;font-family:${FONT};font-size:11px;line-height:1.7;color:${C.muted}">
              <a href="${encodeURI(home)}" style="color:${C.muted};text-decoration:none">Accueil</a>
              &nbsp;·&nbsp;<a href="${encodeURI(appUrl("/collection", locale))}" style="color:${C.muted};text-decoration:none">Ma collection</a>
              &nbsp;·&nbsp;<a href="${encodeURI(appUrl("/marketplace", locale))}" style="color:${C.muted};text-decoration:none">Marketplace</a>
              &nbsp;·&nbsp;<a href="${encodeURI(appUrl("/support", locale))}" style="color:${C.muted};text-decoration:none">Support</a>
            </p>
            ${
              input.showPrefsLink === false
                ? ""
                : `<p style="margin:0 0 8px 0;font-family:${FONT};font-size:11px;line-height:1.7;color:${C.muted}">${
                    input.prefsNote ??
                    `Tu reçois cet e-mail parce que tu as un compte The Park. Tu peux régler ces envois dans <a href="${encodeURI(appUrl("/parametres", locale))}" style="color:${C.body};text-decoration:underline">Paramètres → Notifications</a>.`
                  }</p>`
            }
            <p style="margin:0;font-family:${FONT};font-size:10px;letter-spacing:1px;color:#4b4b54">© ${new Date().getFullYear()} ${esc(EMAIL_BRAND.name)} — 駐車場 · EST. 2026</p>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
