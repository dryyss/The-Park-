-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "shopFreeShippingMin" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "shopStandardShipping" DECIMAL(10,2) NOT NULL DEFAULT 4.90,
    "shopDefaultCarrier" TEXT NOT NULL DEFAULT 'Colissimo',
    "demoUserSlug" TEXT,
    "listingDefaultDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);
