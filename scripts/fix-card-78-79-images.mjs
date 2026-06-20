/**
 * Corrige les imageUrl des cartes 78-79 après conversion PNG → JPEG.
 * Usage : node scripts/fix-card-78-79-images.mjs
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const FIXES = [
  { number: 78, imageUrl: "78_TOYOTA_COROLLA_AE86_LEVIN_POCKET_DRIFTER.jpg" },
  { number: 79, imageUrl: "79_MAZDA_SAVANNA_RX7_FB_UNIQUE.jpg" },
];

async function main() {
  for (const fix of FIXES) {
    const updated = await prisma.card.updateMany({
      where: { number: fix.number },
      data: { imageUrl: fix.imageUrl },
    });
    console.log(`Carte #${fix.number} → ${fix.imageUrl} (${updated.count} ligne(s))`);
  }

  const rows = await prisma.card.findMany({
    where: { number: { in: [77, 78, 79] } },
    select: { number: true, name: true, imageUrl: true, rarity: { select: { code: true } } },
    orderBy: { number: "asc" },
  });
  console.log("\nÉtat actuel :");
  for (const row of rows) {
    console.log(`  #${row.number} [${row.rarity.code}] ${row.imageUrl}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
