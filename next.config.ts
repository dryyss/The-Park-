import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // pg + l'adapter Prisma sont des modules Node (driver Postgres) : on les sort du bundle
  // pour que Turbopack ne tente pas de résoudre des built-ins Node (ex. `util/types`).
  serverExternalPackages: [
    "pg",
    "@prisma/adapter-pg",
    "@prisma/client",
    "sharp",
    "@vercel/blob",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
  // Domaines autorisés pour next/image (images uploadées) : Cellar (S3 Clever)
  // et Vercel Blob (ancien stockage, images historiques).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cellar-c2.services.clever-cloud.com" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
