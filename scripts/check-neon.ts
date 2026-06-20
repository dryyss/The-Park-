/**
 * Vérifie la connexion Neon et les données collection / catalogue.
 * Usage : pnpm check:neon
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function ownedCountByRarity(userId: string): Promise<Map<string, number>> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: {
      quantity: true,
      variant: { select: { card: { select: { rarity: { select: { code: true } } } } } },
    },
  });
  const counts = new Map<string, number>();
  for (const item of items) {
    const code = item.variant.card.rarity.code;
    counts.set(code, (counts.get(code) ?? 0) + item.quantity);
  }
  return counts;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("❌ DATABASE_URL manquant dans .env");
    process.exit(1);
  }

  const host = process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@").split("@")[1]?.split("/")[0];
  console.log(`Connexion Neon → ${host ?? "(masqué)"}\n`);

  const [users, items, cards, withImage] = await Promise.all([
    prisma.user.count(),
    prisma.collectionItem.count({ where: { quantity: { gt: 0 } } }),
    prisma.card.count(),
    prisma.card.count({ where: { imageUrl: { not: null } } }),
  ]);

  console.log("=== Tables ===");
  console.log(`Users              : ${users}`);
  console.log(`CollectionItem (>0): ${items}`);
  console.log(`Card (catalogue)   : ${cards}`);
  console.log(`Card avec imageUrl : ${withImage}`);

  const recent = await prisma.collectionItem.findMany({
    take: 5,
    orderBy: { acquiredAt: "desc" },
    where: { quantity: { gt: 0 } },
    select: {
      quantity: true,
      acquiredAt: true,
      user: { select: { displayName: true, slug: true } },
      variant: {
        select: {
          card: { select: { name: true, rarity: { select: { code: true, label: true } } } },
        },
      },
    },
  });

  console.log("\n=== Derniers CollectionItem ===");
  if (recent.length === 0) {
    console.log("(aucun — le carousel accueil affichera 0 pour les membres connectés)");
  } else {
    for (const row of recent) {
      console.log(
        `  ${row.user.displayName} (@${row.user.slug}) · ${row.variant.card.name} [${row.variant.card.rarity.code}] x${row.quantity}`,
      );
    }
  }

  const sampleUser = recent[0]?.user.slug
    ? await prisma.user.findFirst({ where: { slug: recent[0].user.slug }, select: { id: true, displayName: true } })
    : await prisma.user.findFirst({ select: { id: true, displayName: true } });

  if (sampleUser) {
    const owned = await ownedCountByRarity(sampleUser.id);
    console.log(`\n=== Carousel accueil (${sampleUser.displayName}) ===`);
    if (owned.size === 0) {
      console.log("  Aucune carte possédée par rareté.");
    } else {
      for (const [code, count] of owned) {
        console.log(`  ${code}: ${count} cartes`);
      }
    }
  }

  console.log("\n✅ Neon accessible — les écritures collection passent par prisma.collectionItem.");
}

main()
  .catch((err) => {
    console.error("\n❌ Échec connexion Neon :", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
