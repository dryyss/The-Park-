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
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**"],
    },
  },
});
