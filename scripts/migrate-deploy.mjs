// Applique les migrations avec retries : la base Neon (serverless) se suspend
// au repos et son réveil peut dépasser le timeout de connexion → P1001 au build.
import { spawnSync } from "node:child_process";

const MAX_ATTEMPTS = 4;
const DELAY_MS = 8000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: true,
  });
  if (res.status === 0) process.exit(0);
  if (attempt < MAX_ATTEMPTS) {
    console.log(
      `[migrate] tentative ${attempt}/${MAX_ATTEMPTS} échouée — réveil probable de la base, nouvel essai dans ${DELAY_MS / 1000}s…`,
    );
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}

console.error(`[migrate] échec après ${MAX_ATTEMPTS} tentatives.`);
process.exit(1);
