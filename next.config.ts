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
};

export default withNextIntl(nextConfig);
