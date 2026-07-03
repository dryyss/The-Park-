import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `import "server-only"` jette hors RSC → neutralisé en test par un stub vide.
      "server-only": fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
    // Les tests d'intégration exigent une vraie base — config dédiée : vitest.integration.config.ts.
    exclude: ["test/integration/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**"],
    },
  },
});
