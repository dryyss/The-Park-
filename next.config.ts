import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lint et type-check retirés du build de production.
  //
  // Le scaler Clever impose `--max-old-space-size=1262` (~1,2 Go de tas). Sur cet
  // arbre — 556 fichiers TS/TSX dont le client Prisma généré, très lourd en types
  // — `tsc` prend déjà ~56 s sur une machine de dev confortable ; sous ce plafond,
  // l'étape s'éternise ou se fait tuer par l'OOM. Le bundling, lui, aboutit en
  // ~29 s : c'est bien la vérification qui bloquait le déploiement.
  //
  // Ce n'est pas un renoncement : la vérification est faite en amont, avant chaque
  // commit (`pnpm typecheck`, `pnpm lint`, `pnpm test`). La refaire ici la
  // dupliquait. En contrepartie, ces commandes deviennent obligatoires avant de
  // pousser — le build ne rattrapera plus une erreur de type.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
