import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Park — Trading Card Game",
    short_name: "The Park",
    description:
      "Plateforme de collection, d'échange et de marketplace communautaire dédiée au TCG The Park.",
    start_url: `${SITE_URL}/fr`,
    display: "standalone",
    background_color: "#1E2424",
    theme_color: "#D6004F",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
