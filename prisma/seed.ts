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
  console.log("→ Compte Owner (démo / bootstrap admin)");
  await prisma.user.upsert({
    where: { email: "owner@thepark.local" },
    update: { role: "ADMIN", staffRole: "OWNER", status: "ACTIVE" },
    create: {
      email: "owner@thepark.local",
      displayName: "The Park Owner",
      slug: "the-park-owner",
      role: "ADMIN",
      staffRole: "OWNER",
      status: "ACTIVE",
    },
  });

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
    {
      code: "first_card",
      label: "Première carte",
      description: "Ajouter sa première carte à la collection",
    },
    {
      code: "first_holo",
      label: "Première holo",
      description: "Posséder sa première carte holographique",
    },
    { code: "set_gold", label: "Set Gold", description: "Compléter le palier Gold" },
    {
      code: "unique_owner",
      label: "Carte unique",
      description: "Détenir la carte unique de la saison",
    },
    {
      code: "first_trade",
      label: "Premier échange",
      description: "Réaliser son premier échange/vente",
    },
    { code: "full_season", label: "Saison complète", description: "Compléter une saison à 100 %" },
  ];
  for (const b of badges) {
    await prisma.badge.upsert({ where: { code: b.code }, update: b, create: b });
  }

  console.log("→ Membres de démo + collections");
  // Variantes disponibles (1 Standard FR par carte au seed), triées par n° de carte.
  const allVariants = await prisma.cardVariant.findMany({
    include: { card: true },
    orderBy: { card: { number: "asc" } },
  });
  const variantByNumber = new Map(allVariants.map((v) => [v.card.number, v]));

  const demoMembers = [
    { display: "LIGHTON_FACTORY", owned: 78, rating: 4.9, reviews: 231 },
    { display: "MIDNIGHT_PURPLE", owned: 72, rating: 4.8, reviews: 143 },
    { display: "DRIFT_KING_06", owned: 69, rating: 4.7, reviews: 88 },
    { display: "SARA.S15", owned: 63, rating: 5.0, reviews: 54 },
    { display: "TOUGE_HUNTER", owned: 55, rating: 4.4, reviews: 19 },
    { display: "HACHI_ROKU", owned: 48, rating: 4.6, reviews: 31 },
  ];

  const memberRecords: { id: string; display: string; owned: number }[] = [];
  for (const m of demoMembers) {
    const slug = slugify(m.display);
    const user = await prisma.user.upsert({
      where: { email: `${slug}@thepark.local` },
      update: { displayName: m.display, status: "ACTIVE", ratingAvg: m.rating, reviewCount: m.reviews },
      create: {
        email: `${slug}@thepark.local`,
        displayName: m.display,
        slug,
        role: "MEMBER",
        status: "ACTIVE",
        collectionVisibility: "PUBLIC",
        ratingAvg: m.rating,
        reviewCount: m.reviews,
      },
    });
    memberRecords.push({ id: user.id, display: m.display, owned: m.owned });

    const owned = allVariants.slice(0, m.owned);
    for (const v of owned) {
      await prisma.collectionItem.upsert({
        where: {
          userId_variantId_condition: { userId: user.id, variantId: v.id, condition: "EXCELLENT" },
        },
        update: {},
        create: { userId: user.id, variantId: v.id, condition: "EXCELLENT", quantity: 1 },
      });
    }
  }

  console.log("→ Annonces marketplace (prix indicatifs)");
  const memberIds = memberRecords.map((r) => r.id);
  // Idempotent : on repart d'un état propre pour les annonces de démo.
  await prisma.listing.deleteMany({ where: { sellerId: { in: memberIds } } });

  const ownerByDisplay = new Map(memberRecords.map((r) => [r.display, r.id]));
  type Cond = "MINT" | "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR" | "DAMAGED";
  type Pick = {
    num: number;
    seller: string;
    type: "SELL" | "SELL_OR_TRADE" | "WANT";
    cond: Cond;
    price?: number;
    budgetMax?: number;
  };
  const listingPicks: Pick[] = [
    // On propose (vente / vente ou échange)
    { num: 42, seller: "DRIFT_KING_06", type: "SELL", cond: "MINT", price: 19.9 },
    { num: 64, seller: "MIDNIGHT_PURPLE", type: "SELL", cond: "VERY_GOOD", price: 39.9 },
    { num: 35, seller: "SARA.S15", type: "SELL_OR_TRADE", cond: "VERY_GOOD", price: 14.5 },
    { num: 60, seller: "DRIFT_KING_06", type: "SELL", cond: "GOOD", price: 26.0 },
    { num: 68, seller: "LIGHTON_FACTORY", type: "SELL", cond: "MINT", price: 65.0 },
    { num: 38, seller: "LIGHTON_FACTORY", type: "SELL", cond: "GOOD", price: 12.9 },
    { num: 54, seller: "MIDNIGHT_PURPLE", type: "SELL", cond: "MINT", price: 44.0 },
    { num: 16, seller: "SARA.S15", type: "SELL_OR_TRADE", cond: "EXCELLENT", price: 9.5 },
    { num: 32, seller: "TOUGE_HUNTER", type: "SELL", cond: "DAMAGED", price: 22.0 },
    { num: 57, seller: "LIGHTON_FACTORY", type: "SELL", cond: "EXCELLENT", price: 50.0 },
    { num: 11, seller: "HACHI_ROKU", type: "SELL", cond: "DAMAGED", price: 8.9 },
    { num: 75, seller: "MIDNIGHT_PURPLE", type: "SELL", cond: "MINT", price: 149.0 },
    // On cherche (recherche d'une carte — mise en relation, pas de possession requise)
    { num: 77, seller: "SARA.S15", type: "WANT", cond: "VERY_GOOD", budgetMax: 300.0 },
    { num: 56, seller: "TOUGE_HUNTER", type: "WANT", cond: "VERY_GOOD", budgetMax: 45.0 },
    { num: 71, seller: "MIDNIGHT_PURPLE", type: "WANT", cond: "VERY_GOOD", budgetMax: 60.0 },
    { num: 40, seller: "HACHI_ROKU", type: "WANT", cond: "GOOD", budgetMax: 8.0 },
  ];

  let createdListings = 0;
  for (const p of listingPicks) {
    const variant = variantByNumber.get(p.num);
    const sellerId = ownerByDisplay.get(p.seller);
    if (!variant || !sellerId) continue;
    const isWant = p.type === "WANT";
    await prisma.listing.create({
      data: {
        sellerId,
        variantId: variant.id,
        type: p.type,
        status: "ACTIVE",
        price: isWant ? null : p.price,
        budgetMax: isWant ? p.budgetMax : null,
        minCondition: isWant ? p.cond : null,
        condition: p.cond,
        quantity: 1,
        shippingMode: "STANDARD",
      },
    });
    createdListings++;
  }

  const [total, members, listings] = await Promise.all([
    prisma.card.count(),
    prisma.user.count({ where: { role: "MEMBER" } }),
    prisma.listing.count(),
  ]);

  console.log("→ Boutique officielle (produits Lighton)");
  const sampleImg = (CARDS as RawCard[])[0]?.img ?? "placeholder.jpg";
  const imgPath = sampleImg.startsWith("/") ? sampleImg : `/uploads/${sampleImg}`;

  const shopProducts = [
    {
      sku: "TP-S01-DISPLAY",
      slug: "display-moteur-forge",
      name: "Display Moteur Forgé",
      type: "DISPLAY" as const,
      price: 89.9,
      stock: 12,
      description:
        "La boîte scellée : 20 boosters de 5 cartes, soit 100 cartes Saison 1. Garantie d'au moins une Légendaire ou Gold par display.",
      images: [imgPath],
    },
    {
      sku: "TP-S01-BOOSTER",
      slug: "booster-moteur-forge",
      name: "Booster Moteur Forgé",
      type: "BOOSTER" as const,
      price: 4.9,
      stock: 240,
      description: "5 cartes Saison 1 · Moteur Forgé.",
      images: [imgPath],
    },
    {
      sku: "TP-S01-STARTER",
      slug: "starter-drift-pack",
      name: "Starter Drift Pack",
      type: "STARTER_DECK" as const,
      price: 14.9,
      stock: 45,
      description: "Deck prêt à jouer + 2 boosters.",
      images: [imgPath],
    },
    {
      sku: "TP-PROMO-LAUNCH",
      slug: "pack-lancement",
      name: "Pack Lancement",
      type: "PROMO_PACK" as const,
      price: 24.9,
      stock: 0,
      description: "Édition fondateurs — épuisé.",
      images: [imgPath],
    },
    {
      sku: "TP-MERCH-TEE",
      slug: "tee-lighton",
      name: "T-shirt Lighton · 駐車場",
      type: "MERCH" as const,
      price: 29.9,
      stock: 18,
      description: "Coton bio · sérigraphie JDM.",
      images: [imgPath],
    },
    {
      sku: "TP-S01-DISPLAY-LE",
      slug: "display-moteur-forge-le",
      name: "Display Moteur Forgé · Édition limitée",
      type: "LIMITED_EDITION" as const,
      price: 99.9,
      stock: 3,
      description: "Display numéroté · artwork exclusif.",
      images: [imgPath],
    },
  ];

  for (const p of shopProducts) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        slug: p.slug,
        type: p.type,
        price: p.price,
        stock: p.stock,
        description: p.description,
        images: p.images,
        active: true,
      },
      create: { ...p, active: true },
    });
  }

  console.log("→ Échanges de démo");
  const factoryId = ownerByDisplay.get("LIGHTON_FACTORY");
  const midnightId = ownerByDisplay.get("MIDNIGHT_PURPLE");
  const driftId = ownerByDisplay.get("DRIFT_KING_06");
  const saraId = ownerByDisplay.get("SARA.S15");
  const tougeId = ownerByDisplay.get("TOUGE_HUNTER");
  const hachiId = ownerByDisplay.get("HACHI_ROKU");

  if (factoryId && midnightId && driftId && saraId && tougeId && hachiId) {
    await prisma.exchange.deleteMany({
      where: { OR: [{ initiatorId: factoryId }, { recipientId: factoryId }] },
    });

    const v = (n: number) => variantByNumber.get(n)!;

    type ExSeed = {
      recipientId: string;
      status: "PROPOSED" | "ACCEPTED" | "AWAITING_SHIPMENT" | "COMPLETED";
      secured?: boolean;
      message?: string;
      giveNums: number[];
      getNums: number[];
    };

    const exchangeSeeds: ExSeed[] = [
      { recipientId: midnightId, status: "PROPOSED", giveNums: [38], getNums: [64], message: "Intéressé par ton Ultra ?" },
      { recipientId: driftId, status: "ACCEPTED", giveNums: [57], getNums: [42], secured: true },
      { recipientId: saraId, status: "AWAITING_SHIPMENT", giveNums: [68], getNums: [35], secured: true },
      { recipientId: tougeId, status: "COMPLETED", giveNums: [16], getNums: [32] },
      { recipientId: hachiId, status: "COMPLETED", giveNums: [54], getNums: [11] },
    ];

    for (const ex of exchangeSeeds) {
      await prisma.exchange.create({
        data: {
          initiatorId: factoryId,
          recipientId: ex.recipientId,
          status: ex.status,
          secured: ex.secured ?? false,
          message: ex.message,
          completedAt: ex.status === "COMPLETED" ? new Date() : undefined,
          items: {
            create: [
              ...ex.giveNums.map((n) => ({
                fromInitiator: true,
                variantId: v(n).id,
                condition: "EXCELLENT" as const,
              })),
              ...ex.getNums.map((n) => ({
                fromInitiator: false,
                variantId: v(n).id,
                condition: "VERY_GOOD" as const,
              })),
            ],
          },
        },
      });
    }

    const firstBadge = await prisma.badge.findFirst({ where: { code: "first_card" } });
    const holoBadge = await prisma.badge.findFirst({ where: { code: "first_holo" } });
    if (firstBadge) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: factoryId, badgeId: firstBadge.id } },
        update: {},
        create: { userId: factoryId, badgeId: firstBadge.id },
      });
    }
    if (holoBadge) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: factoryId, badgeId: holoBadge.id } },
        update: {},
        create: { userId: factoryId, badgeId: holoBadge.id },
      });
    }

    if (midnightId && driftId) {
      await prisma.review.deleteMany({ where: { targetId: factoryId } });
      await prisma.review.createMany({
        data: [
          {
            authorId: midnightId,
            targetId: factoryId,
            source: "EXCHANGE",
            rating: 5,
            comment: "Échange rapide et soigné, cartes bien protégées.",
          },
          {
            authorId: driftId,
            targetId: factoryId,
            source: "EXCHANGE",
            rating: 5,
            comment: "Top vendeur, communication claire.",
          },
          {
            authorId: saraId,
            targetId: factoryId,
            source: "EXCHANGE",
            rating: 4,
            comment: "Colis reçu en bon état.",
          },
        ],
      });
    }
  }

  console.log(
    `✅ Seed terminé — ${total} cartes · ${members} membres · ${listings} annonces (${createdListings} créées).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
