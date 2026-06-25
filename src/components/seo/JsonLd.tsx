import { SITE_URL, absoluteImageUrl, canonical } from "@/lib/seo";
import type { ShopProduct } from "@/server/shop/shop.service";

export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["Organization", "WebApplication"],
    name: "The Park",
    alternateName: "The Park TCG",
    url: SITE_URL,
    logo: `${SITE_URL}/magar-developpement-logo.svg`,
    description:
      "Plateforme de collection, d'échange et de marketplace communautaire dédiée au TCG The Park (univers drift / JDM).",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    inLanguage: ["fr-FR", "en", "ja"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      category: "Free to play",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Park",
    alternateName: "The Park TCG",
    url: SITE_URL,
    inLanguage: ["fr-FR", "en", "ja"],
    publisher: { "@type": "Organization", name: "The Park", url: SITE_URL },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/fr/recherche?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function TradingCardJsonLd({
  card,
  locale,
}: {
  card: {
    name: string;
    slug: string;
    image: string;
    description: string | null;
    rarityLabel: string;
    seasonName: string;
  };
  locale: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: card.name,
    description: card.description ?? `${card.name} — ${card.rarityLabel} (${card.seasonName})`,
    image: absoluteImageUrl(card.image),
    url: canonical(`/${locale}/carte/${card.slug}`),
    brand: { "@type": "Brand", name: "The Park" },
    category: "Trading Card",
    additionalProperty: [
      { "@type": "PropertyValue", name: "Rarity", value: card.rarityLabel },
      { "@type": "PropertyValue", name: "Season", value: card.seasonName },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function ProductJsonLd({ product, locale }: { product: ShopProduct; locale: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.name,
    image: product.image ? absoluteImageUrl(product.image) : absoluteImageUrl(undefined),
    url: canonical(`/${locale}/boutique/${product.slug}`),
    sku: product.sku,
    brand: { "@type": "Brand", name: "The Park" },
    offers: {
      "@type": "Offer",
      price: product.priceRaw,
      priceCurrency: "EUR",
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonical(`/${locale}/boutique/${product.slug}`),
      seller: { "@type": "Organization", name: "The Park — Boutique officielle" },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
