import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
// @ts-ignore - module de données JS sans types (catalogue fourni par le client)
import { CARDS, META, CARD_EXTRA_VERSIONS, DEFAULT_S01_EDITION_LABEL, CARD_EDITION_LABELS } from "./cards-data.mjs";
import { VERSION_TYPE_DEFINITIONS } from "../src/lib/card-versions";

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

  console.log("→ Saison 2 (teaser verrouillée)");
  await prisma.season.upsert({
    where: { code: "S02" },
    update: { name: "Nuit Tokyo", releaseDate: new Date("2027-06-01T18:00:00+02:00") },
    create: {
      code: "S02",
      name: "Nuit Tokyo",
      sortOrder: 2,
      releaseDate: new Date("2027-06-01T18:00:00+02:00"),
    },
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
  // Retrait des variantes obsolètes (reverse / alternative).
  const obsoleteCodes = ["reverse", "alternative"];
  const obsoleteTypes = await prisma.versionType.findMany({ where: { code: { in: obsoleteCodes } } });
  const obsoleteTypeIds = obsoleteTypes.map((t) => t.id);
  if (obsoleteTypeIds.length > 0) {
    const obsoleteVariants = await prisma.cardVariant.findMany({
      where: { versionTypeId: { in: obsoleteTypeIds } },
      select: { id: true },
    });
    const obsoleteVariantIds = obsoleteVariants.map((v) => v.id);
    if (obsoleteVariantIds.length > 0) {
      await prisma.exchangeItem.deleteMany({ where: { variantId: { in: obsoleteVariantIds } } });
      await prisma.auction.deleteMany({ where: { variantId: { in: obsoleteVariantIds } } });
      await prisma.listing.deleteMany({ where: { variantId: { in: obsoleteVariantIds } } });
      await prisma.collectionItem.deleteMany({ where: { variantId: { in: obsoleteVariantIds } } });
      await prisma.cardVariant.deleteMany({ where: { id: { in: obsoleteVariantIds } } });
    }
    await prisma.versionType.deleteMany({ where: { id: { in: obsoleteTypeIds } } });
  }

  const versionTypes = VERSION_TYPE_DEFINITIONS.map(({ code, label, isFoil, sortOrder }) => ({
    code,
    label,
    isFoil,
    sortOrder,
  }));
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
  const extraVersionsByNumber = CARD_EXTRA_VERSIONS as Record<number, readonly string[]>;
  const editionOverrides = CARD_EDITION_LABELS as Record<number, string | null | undefined>;

  function catalogEditionForCard(num: number): string | null {
    if (Object.prototype.hasOwnProperty.call(editionOverrides, num)) {
      return editionOverrides[num] ?? null;
    }
    return DEFAULT_S01_EDITION_LABEL;
  }

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

    const editionLabel = catalogEditionForCard(c.num);

    // Standard (toutes) + versions optionnelles du catalogue
    await prisma.cardVariant.upsert({
      where: {
        cardId_versionTypeId_language: {
          cardId: card.id,
          versionTypeId: vtByCode["standard"],
          language: "FR",
        },
      },
      update: { editionLabel },
      create: { cardId: card.id, versionTypeId: vtByCode["standard"], language: "FR", editionLabel },
    });

    const extras = extraVersionsByNumber[c.num] ?? [];
    for (const code of extras) {
      const versionTypeId = vtByCode[code];
      if (!versionTypeId) continue;
      await prisma.cardVariant.upsert({
        where: {
          cardId_versionTypeId_language: {
            cardId: card.id,
            versionTypeId,
            language: "FR",
          },
        },
        update: { editionLabel },
        create: { cardId: card.id, versionTypeId, language: "FR", editionLabel },
      });
    }
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
  const standardVtId = vtByCode["standard"];
  const allVariants = await prisma.cardVariant.findMany({
    where: { versionTypeId: standardVtId },
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

  const lightonId = memberRecords.find((m) => m.display === "LIGHTON_FACTORY")?.id;
  if (lightonId) {
    const extraVariants = await prisma.cardVariant.findMany({
      where: { versionType: { code: { not: "standard" } } },
      include: { card: true, versionType: true },
    });
    for (const v of extraVariants) {
      const extras = extraVersionsByNumber[v.card.number] ?? [];
      if (!extras.includes(v.versionType.code)) continue;
      await prisma.collectionItem.upsert({
        where: {
          userId_variantId_condition: { userId: lightonId, variantId: v.id, condition: "EXCELLENT" },
        },
        update: {},
        create: { userId: lightonId, variantId: v.id, condition: "EXCELLENT", quantity: 1 },
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
    type: "SELL" | "SELL_OR_TRADE" | "TRADE" | "WANT";
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
    { num: 42, seller: "DRIFT_KING_06", type: "TRADE", cond: "MINT", price: 0 },
    { num: 71, seller: "TOUGE_HUNTER", type: "TRADE", cond: "VERY_GOOD", price: 0 },
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
      releaseDate: new Date("2026-09-01T18:00:00+02:00"),
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
        ...( "releaseDate" in p ? { releaseDate: p.releaseDate } : {}),
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
      where: { OR: [{ initiatorId: { in: memberIds } }, { recipientId: { in: memberIds } }] },
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

    // Échanges entrants pour d'autres membres (propositions à traiter)
    const crossSeeds: ExSeed[] = [
      { recipientId: midnightId, status: "PROPOSED", giveNums: [60], getNums: [64], message: "Échange contre ton Skyline ?" },
      { recipientId: tougeId, status: "PROPOSED", giveNums: [11], getNums: [32], message: "Je te propose mon AE86." },
    ];
    const crossInitiators = [driftId, saraId] as const;

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

    for (let i = 0; i < crossSeeds.length; i++) {
      const ex = crossSeeds[i];
      const initiatorId = crossInitiators[i];
      if (!initiatorId) continue;
      await prisma.exchange.create({
        data: {
          initiatorId,
          recipientId: ex.recipientId,
          status: ex.status,
          secured: ex.secured ?? false,
          message: ex.message,
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

    console.log("→ Notifications, wishlist, enchères, panier, commande, messagerie");
    await prisma.notification.deleteMany({ where: { userId: factoryId } });
    await prisma.notification.createMany({
      data: [
        {
          userId: factoryId,
          type: "EXCHANGE_PROPOSED",
          actorId: midnightId,
          entityType: "EXCHANGE",
          payload: { partner: "MIDNIGHT_PURPLE" },
        },
        {
          userId: factoryId,
          type: "MESSAGE_RECEIVED",
          actorId: driftId,
          entityType: "CONVERSATION",
          payload: { preview: "Salut, colis prêt !" },
        },
        {
          userId: factoryId,
          type: "AUCTION_OUTBID",
          actorId: saraId,
          entityType: "AUCTION",
          payload: { card: "Turbo Phantom", amount: "45,00 €" },
        },
        {
          userId: factoryId,
          type: "BADGE_UNLOCKED",
          payload: { badge: "Première holo" },
        },
        {
          userId: factoryId,
          type: "ORDER_UPDATE",
          entityType: "ORDER",
          payload: { status: "SHIPPED", orderNumber: "TP-2026-00042" },
        },
      ],
    });

    const wishlistNums = [77, 56, 71, 40, 68];
    for (const n of wishlistNums) {
      const card = await prisma.card.findFirst({ where: { number: n, seasonId: season.id } });
      if (!card) continue;
      await prisma.wishlistItem.upsert({
        where: { userId_cardId: { userId: factoryId, cardId: card.id } },
        update: {},
        create: { userId: factoryId, cardId: card.id },
      });
    }

    await prisma.bid.deleteMany({ where: { auction: { sellerId: { in: memberIds } } } });
    await prisma.auction.deleteMany({ where: { sellerId: { in: memberIds } } });

    const auctionSeeds = [
      { num: 42, seller: "DRIFT_KING_06", start: 15, current: 19.9, hours: 4 },
      { num: 64, seller: "MIDNIGHT_PURPLE", start: 30, current: 39.9, hours: 12 },
      { num: 75, seller: "MIDNIGHT_PURPLE", start: 100, current: 149, hours: 2 },
    ];
    const endsBase = Date.now();
    for (const a of auctionSeeds) {
      const variant = variantByNumber.get(a.num);
      const sellerId = ownerByDisplay.get(a.seller);
      if (!variant || !sellerId) continue;
      const auction = await prisma.auction.create({
        data: {
          sellerId,
          variantId: variant.id,
          startPrice: a.start,
          currentPrice: a.current,
          status: "ACTIVE",
          startsAt: new Date(endsBase - 86400000),
          endsAt: new Date(endsBase + a.hours * 3600000),
          antiSnipe: true,
        },
      });
      await prisma.bid.createMany({
        data: [
          { auctionId: auction.id, bidderId: factoryId, amount: a.current - 2 },
          { auctionId: auction.id, bidderId: saraId!, amount: a.current },
        ],
      });
    }

    const booster = await prisma.product.findFirst({ where: { sku: "TP-S01-BOOSTER" } });
    const display = await prisma.product.findFirst({ where: { sku: "TP-S01-DISPLAY" } });
    if (booster && display) {
      await prisma.cartItem.deleteMany({ where: { userId: factoryId } });
      await prisma.cartItem.createMany({
        data: [
          { userId: factoryId, productId: booster.id, quantity: 2 },
          { userId: factoryId, productId: display.id, quantity: 1 },
        ],
      });

      await prisma.orderItem.deleteMany({ where: { order: { userId: factoryId } } });
      await prisma.order.deleteMany({ where: { userId: factoryId } });
      await prisma.order.create({
        data: {
          orderNumber: "TP-2026-00042",
          userId: factoryId,
          status: "SHIPPED",
          subtotal: 99.7,
          shippingCost: 0,
          total: 99.7,
          shippingName: "LIGHTON_FACTORY",
          shippingLine1: "12 rue du Drift",
          shippingZip: "75011",
          shippingCity: "Paris",
          shippingCountry: "FR",
          shippingMethod: "Colissimo",
          trackingNumber: "6A12345678901",
          shippedAt: new Date(),
          items: {
            create: [
              { productId: display.id, quantity: 1, unitPrice: 89.9 },
              { productId: booster.id, quantity: 2, unitPrice: 4.9 },
            ],
          },
        },
      });
    }

    const acceptedExchange = await prisma.exchange.findFirst({
      where: { initiatorId: factoryId, recipientId: driftId, status: "ACCEPTED" },
    });
    if (acceptedExchange) {
      await prisma.message.deleteMany({
        where: { conversation: { exchangeId: acceptedExchange.id } },
      });
      await prisma.conversationParticipant.deleteMany({
        where: { conversation: { exchangeId: acceptedExchange.id } },
      });
      await prisma.conversation.deleteMany({ where: { exchangeId: acceptedExchange.id } });

      const conv = await prisma.conversation.create({
        data: {
          context: "EXCHANGE",
          exchangeId: acceptedExchange.id,
          participants: {
            create: [{ userId: factoryId }, { userId: driftId }],
          },
          messages: {
            create: [
              { senderId: factoryId, body: "Salut ! Échange validé de mon côté, j'expédie demain." },
              { senderId: driftId, body: "Parfait, pareil ici. Envoi sécurisé activé ?" },
              { senderId: factoryId, body: "Oui, caution autorisée. Je filme l'emballage in-app." },
            ],
          },
        },
      });
      void conv;
    }

    await prisma.user.update({
      where: { id: factoryId },
      data: { role: "ADMIN", staffRole: "OWNER" },
    });

    console.log("→ Signalements & litiges (modération démo)");
    await prisma.report.deleteMany({});
    await prisma.dispute.deleteMany({});

    if (midnightId && driftId) {
      await prisma.report.create({
        data: {
          reporterId: driftId,
          targetType: "LISTING",
          targetId: "demo-listing",
          reason: "Prix manifestement incohérent avec la cote.",
          involvesMinor: false,
          priority: 0,
        },
      });
      await prisma.report.create({
        data: {
          reporterId: hachiId!,
          targetType: "USER",
          targetId: tougeId!,
          reason: "Comportement inapproprié en chat d'échange.",
          involvesMinor: true,
          priority: 100,
        },
      });
      await prisma.dispute.create({
        data: {
          type: "EXCHANGE",
          reason: "Colis reçu endommagé — preuves vidéo contestées.",
          claimantId: midnightId,
          respondentId: driftId,
          involvesMinor: false,
          priority: 10,
        },
      });
    }
  }

  console.log("→ Réglages plateforme");
  await prisma.platformConfig.upsert({
    where: { id: "default" },
    update: {
      shopFreeShippingMin: 50,
      shopStandardShipping: 4.9,
      shopDefaultCarrier: "Colissimo",
      demoUserSlug: null,
      listingDefaultDays: 30,
    },
    create: {
      id: "default",
      shopFreeShippingMin: 50,
      shopStandardShipping: 4.9,
      shopDefaultCarrier: "Colissimo",
      demoUserSlug: null,
      listingDefaultDays: 30,
    },
  });

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
