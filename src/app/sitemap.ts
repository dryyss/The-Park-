import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { PUBLIC_INDEX_PATHS, SITE_URL } from "@/lib/seo";
import { getPublicCollectorSlugs } from "@/server/seo/seo.service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries = routing.locales.flatMap((locale) =>
    PUBLIC_INDEX_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : path.includes("boutique") || path.includes("marketplace") ? 0.9 : 0.7,
    })),
  );

  let cardEntries: MetadataRoute.Sitemap = [];
  let productEntries: MetadataRoute.Sitemap = [];
  let collectorEntries: MetadataRoute.Sitemap = [];

  try {
    const [cards, products, collectors] = await Promise.all([
      prisma.card.findMany({ select: { slug: true, updatedAt: true }, take: 500 }),
      prisma.product.findMany({
        where: { active: true },
        select: { slug: true, updatedAt: true },
        take: 200,
      }),
      getPublicCollectorSlugs(500),
    ]);

    cardEntries = routing.locales.flatMap((locale) =>
      cards.map((card) => ({
        url: `${SITE_URL}/${locale}/carte/${card.slug}`,
        lastModified: card.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    );

    productEntries = routing.locales.flatMap((locale) =>
      products.map((product) => ({
        url: `${SITE_URL}/${locale}/boutique/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.65,
      })),
    );

    collectorEntries = routing.locales.flatMap((locale) =>
      collectors.map((collector) => ({
        url: `${SITE_URL}/${locale}/collectionneur/${collector.slug}`,
        lastModified: collector.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
    );
  } catch {
    // DB indisponible au build — pages statiques uniquement
  }

  return [...staticEntries, ...cardEntries, ...productEntries, ...collectorEntries];
}
