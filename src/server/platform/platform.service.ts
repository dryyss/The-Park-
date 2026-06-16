import "server-only";
import { prisma } from "@/lib/prisma";

export interface ShopShippingConfig {
  freeShippingMin: number;
  standardShipping: number;
  defaultCarrier: string;
}

export interface PlatformConfigView {
  shopShipping: ShopShippingConfig;
  demoUserSlug: string | null;
  listingDefaultDays: number;
}

const DEFAULTS: PlatformConfigView = {
  shopShipping: { freeShippingMin: 50, standardShipping: 4.9, defaultCarrier: "Colissimo" },
  demoUserSlug: null,
  listingDefaultDays: 30,
};

async function getRow() {
  return prisma.platformConfig.findUnique({ where: { id: "default" } });
}

export async function getPlatformConfig(): Promise<PlatformConfigView> {
  const row = await getRow();
  if (!row) return DEFAULTS;
  return {
    shopShipping: {
      freeShippingMin: Number(row.shopFreeShippingMin),
      standardShipping: Number(row.shopStandardShipping),
      defaultCarrier: row.shopDefaultCarrier,
    },
    demoUserSlug: row.demoUserSlug,
    listingDefaultDays: row.listingDefaultDays,
  };
}

export async function getShopShippingConfig(): Promise<ShopShippingConfig> {
  return (await getPlatformConfig()).shopShipping;
}

/** Calcule les frais de port boutique officielle depuis la config DB. */
export async function computeShopShipping(subtotalRaw: number): Promise<number> {
  if (subtotalRaw <= 0) return 0;
  const cfg = await getShopShippingConfig();
  return subtotalRaw >= cfg.freeShippingMin ? 0 : cfg.standardShipping;
}

export async function updatePlatformConfig(data: {
  shopFreeShippingMin?: number;
  shopStandardShipping?: number;
  shopDefaultCarrier?: string;
  demoUserSlug?: string | null;
  listingDefaultDays?: number;
}): Promise<void> {
  await prisma.platformConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      shopFreeShippingMin: data.shopFreeShippingMin ?? DEFAULTS.shopShipping.freeShippingMin,
      shopStandardShipping: data.shopStandardShipping ?? DEFAULTS.shopShipping.standardShipping,
      shopDefaultCarrier: data.shopDefaultCarrier ?? DEFAULTS.shopShipping.defaultCarrier,
      demoUserSlug: data.demoUserSlug ?? null,
      listingDefaultDays: data.listingDefaultDays ?? DEFAULTS.listingDefaultDays,
    },
    update: {
      ...(data.shopFreeShippingMin !== undefined ? { shopFreeShippingMin: data.shopFreeShippingMin } : {}),
      ...(data.shopStandardShipping !== undefined ? { shopStandardShipping: data.shopStandardShipping } : {}),
      ...(data.shopDefaultCarrier !== undefined ? { shopDefaultCarrier: data.shopDefaultCarrier } : {}),
      ...(data.demoUserSlug !== undefined ? { demoUserSlug: data.demoUserSlug } : {}),
      ...(data.listingDefaultDays !== undefined ? { listingDefaultDays: data.listingDefaultDays } : {}),
    },
  });
}
