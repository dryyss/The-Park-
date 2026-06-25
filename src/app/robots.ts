import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/*/admin/",
          "/*/dashboard/",
          "/*/parametres/",
          "/*/portefeuille/",
          "/*/messages/",
          "/*/notifications/",
          "/*/profil/",
          "/*/onboarding/",
          "/*/panier/",
          "/*/wishlist/",
          "/*/acces-admin-refuse/",
          "/*/securite/",
          "/*/vendre/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
