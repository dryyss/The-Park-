import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getAppBaseUrl } from "@/lib/env";
import type { CardSeoData, CollectorSeoData, ProductSeoData } from "@/server/seo/seo.service";

export const SITE_NAME = "The Park";
export const SITE_URL = getAppBaseUrl();
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export const LOCAL_KEYWORDS = [
  "The Park TCG",
  "trading card game",
  "cartes à collectionner",
  "marketplace cartes",
  "échange cartes",
  "JDM drift",
  "collection TCG",
] as const;

export function canonical(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

/** URL absolue pour une image (relative ou déjà absolue). */
export function absoluteImageUrl(image: string | null | undefined): string {
  if (!image) return `${SITE_URL}${DEFAULT_OG_IMAGE}`;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`;
}

export function localeAlternates(pathSuffix: string, locale: string): Metadata["alternates"] {
  const normalized = pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`;
  const withoutLocale = normalized.replace(/^\/(fr|en|ja)/, "");
  return {
    canonical: canonical(`/${locale}${withoutLocale}`),
    languages: {
      fr: canonical(`/fr${withoutLocale}`),
      en: canonical(`/en${withoutLocale}`),
      ja: canonical(`/ja${withoutLocale}`),
    },
  };
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
  locale?: string;
}): Metadata {
  const url = canonical(opts.path);
  const ogTitle = opts.title.includes(SITE_NAME) ? opts.title : `${opts.title} | ${SITE_NAME}`;

  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords ?? [...LOCAL_KEYWORDS],
    alternates: opts.locale
      ? localeAlternates(opts.path, opts.locale)
      : { canonical: url },
    openGraph: {
      title: ogTitle,
      description: opts.description,
      url,
      siteName: SITE_NAME,
      locale: opts.locale === "en" ? "en_US" : opts.locale === "ja" ? "ja_JP" : "fr_FR",
      type: "website",
      images: [{ url: absoluteImageUrl(opts.ogImage ?? DEFAULT_OG_IMAGE), alt: opts.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: opts.description,
      images: [absoluteImageUrl(opts.ogImage ?? DEFAULT_OG_IMAGE)],
    },
    ...(opts.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Pages publiques indexables (sans préfixe locale — ajouté dans le sitemap). */
export const PUBLIC_INDEX_PATHS = [
  "",
  "/boutique",
  "/marketplace",
  "/collection",
  "/saison-1",
  "/saison-2",
  "/hors-serie",
  "/classements",
  "/trophees",
  "/echanges",
  "/encheres",
  "/drop",
  "/aide",
  "/recherche",
  "/trophees",
] as const;

type DynamicSeoLocale = Locale;

const CARD_SEO = {
  fr: (c: CardSeoData) => ({
    title: `${c.name} — #${c.number} · ${c.rarityLabel}`,
    description:
      c.description ??
      `Fiche carte ${c.name} (${c.seasonName}) — rareté ${c.rarityLabel}. Catalogue, collection et marketplace The Park TCG.`,
  }),
  en: (c: CardSeoData) => ({
    title: `${c.name} — #${c.number} · ${c.rarityLabel}`,
    description:
      c.description ??
      `${c.name} card (${c.seasonName}) — ${c.rarityLabel} rarity. Catalog, collection and marketplace on The Park TCG.`,
  }),
  ja: (c: CardSeoData) => ({
    title: `${c.name} — #${c.number} · ${c.rarityLabel}`,
    description:
      c.description ??
      `${c.name}（${c.seasonName}）— レアリティ ${c.rarityLabel}。The Park TCG のカタログ・コレクション・マーケット。`,
  }),
} as const satisfies Record<DynamicSeoLocale, (c: CardSeoData) => { title: string; description: string }>;

const PRODUCT_SEO = {
  fr: (p: ProductSeoData) => ({
    title: `${p.name} — Boutique officielle`,
    description:
      p.description ??
      `Achetez ${p.name} sur la boutique officielle The Park. Vente directe Lighton, paiement sécurisé Stripe.`,
  }),
  en: (p: ProductSeoData) => ({
    title: `${p.name} — Official shop`,
    description:
      p.description ??
      `Buy ${p.name} from the official The Park shop. Direct sale by Lighton, secure Stripe checkout.`,
  }),
  ja: (p: ProductSeoData) => ({
    title: `${p.name} — 公式ショップ`,
    description:
      p.description ??
      `${p.name} を The Park 公式ショップで購入。Lighton 直販、Stripe 安全決済。`,
  }),
} as const satisfies Record<DynamicSeoLocale, (p: ProductSeoData) => { title: string; description: string }>;

const COLLECTOR_SEO = {
  fr: (c: CollectorSeoData) => ({
    title: `Collection de ${c.displayName}`,
    description:
      c.bio ??
      `Profil collectionneur ${c.displayName} sur The Park : ${c.owned}/${c.total} cartes. Marketplace et échanges communautaires.`,
  }),
  en: (c: CollectorSeoData) => ({
    title: `${c.displayName}'s collection`,
    description:
      c.bio ??
      `Collector profile ${c.displayName} on The Park: ${c.owned}/${c.total} cards. Community marketplace and trades.`,
  }),
  ja: (c: CollectorSeoData) => ({
    title: `${c.displayName} のコレクション`,
    description:
      c.bio ??
      `The Park のコレクター ${c.displayName}：${c.owned}/${c.total} 枚。コミュニティマーケットと交換。`,
  }),
} as const satisfies Record<DynamicSeoLocale, (c: CollectorSeoData) => { title: string; description: string }>;

function resolveLocale(locale: string): DynamicSeoLocale {
  return (locale === "en" || locale === "ja" ? locale : "fr") as DynamicSeoLocale;
}

export function cardPageMetadata(card: CardSeoData, locale: string): Metadata {
  const loc = resolveLocale(locale);
  const copy = CARD_SEO[loc](card);
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/carte/${card.slug}`,
    locale,
    ogImage: card.image,
  });
}

export function productPageMetadata(product: ProductSeoData, locale: string): Metadata {
  const loc = resolveLocale(locale);
  const copy = PRODUCT_SEO[loc](product);
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/boutique/${product.slug}`,
    locale,
    ogImage: product.image ?? undefined,
  });
}

export function collectorPageMetadata(collector: CollectorSeoData, locale: string): Metadata {
  const loc = resolveLocale(locale);
  const copy = COLLECTOR_SEO[loc](collector);
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}/collectionneur/${collector.slug}`,
    locale,
  });
}
