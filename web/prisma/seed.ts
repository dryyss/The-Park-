import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
// @ts-ignore - module de données JS sans types (catalogue fourni par le client)
import { CARDS, META } from "./cards-data.mjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type RawCard = {
  num: number;
  name: string;
  r: string; // code rareté
  img: string;
  val: number;
  ch: number;
  kg: number;
  co: string;
  d: string;
};

const RARITY_ORDER = ["c", "r", "u", "l", "g", "p"] as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("→ Saison");
  const season = await prisma.season.upsert({
    where: { code: "S01" },
    update: { name: "Moteur Forgé" },
    create: { code: "S01", name: "Moteur Forgé", sortOrder: 1 },
  });

  console.log("→ Raretés");
  const rarityByCode: Record<string, string> = {};
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    const code = RARITY_ORDER[i];
    const m = (META as Record<string, { label: string; glyph: string; color: string }>)[code];
    const r = await prisma.rarity.upsert({
      where: { code },
      update: { label: m.label, symbol: m.glyph, color: m.color, sortOrder: i },
      create: { code, label: m.label, symbol: m.glyph, color: m.color, sortOrder: i },
    });
    rarityByCode[code] = r.id;
  }

  console.log("→ Types de version");
  const versionTypes = [
    { code: "standard", label: "Standard", isFoil: false, sortOrder: 0 },
    { code: "reverse", label: "Reverse", isFoil: true, sortOrder: 1 },
    { code: "special", label: "Édition spéciale", isFoil: false, sortOrder: 2 },
    { code: "alternative", label: "Alternative", isFoil: false, sortOrder: 3 },
  ];
  const vtByCode: Record<string, string> = {};
  for (const vt of versionTypes) {
    const v = await prisma.versionType.upsert({
      where: { code: vt.code },
      update: vt,
      create: vt,
    });
    vtByCode[vt.code] = v.id;
  }

  console.log(`→ Cartes (${(CARDS as RawCard[]).length})`);
  for (const c of CARDS as RawCard[]) {
    const slug = `s01-${String(c.num).padStart(2, "0")}-${slugify(c.name)}`;
    const data = {
      name: c.name,
      rarityId: rarityByCode[c.r],
      imageUrl: c.img,
      quoteValue: c.val,
      powerCh: c.ch,
      weightKg: c.kg,
      country: c.co,
      description: c.d,
      isUnique: c.r === "p",
    };
    const card = await prisma.card.upsert({
      where: { seasonId_number: { seasonId: season.id, number: c.num } },
      update: data,
      create: { seasonId: season.id, number: c.num, slug, ...data },
    });

    // Variante Standard FR par défaut (le reste se peuplera via la collection / import)
    await prisma.cardVariant.upsert({
      where: {
        cardId_versionTypeId_language: {
          cardId: card.id,
          versionTypeId: vtByCode["standard"],
          language: "FR",
        },
      },
      update: {},
      create: { cardId: card.id, versionTypeId: vtByCode["standard"], language: "FR" },
    });
  }

  console.log("→ Badges (CDC Module 9)");
  const badges = [
    { code: "first_card", label: "Première carte", description: "Ajouter sa première carte à la collection" },
    { code: "first_holo", label: "Première holo", description: "Posséder sa première carte holographique" },
    { code: "set_gold", label: "Set Gold", description: "Compléter le palier Gold" },
    { code: "unique_owner", label: "Carte unique", description: "Détenir la carte unique de la saison" },
    { code: "first_trade", label: "Premier échange", description: "Réaliser son premier échange/vente" },
    { code: "full_season", label: "Saison complète", description: "Compléter une saison à 100 %" },
  ];
  for (const b of badges) {
    await prisma.badge.upsert({ where: { code: b.code }, update: b, create: b });
  }

  const total = await prisma.card.count();
  console.log(`✅ Seed terminé — ${total} cartes en base.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
