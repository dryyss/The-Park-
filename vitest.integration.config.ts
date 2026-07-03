import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Tests d'intégration : vraie base (DATABASE_URL du .env), services réels.
 * Stripe/Resend/Pusher/Blob sont désactivés par setup-env.ts → chemins "dev mode" simulés.
 * Exécution séquentielle : Neon (endpoint non poolé) rejette les rafales de connexions.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["test/integration/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
