-- Showroom : classeurs curatés du collectionneur (grille configurable, pages, cartes placées).
-- Migration idempotente (contrainte P3018 sur ce projet — cf. commit 7f7276f).

-- CreateTable: classeur
CREATE TABLE IF NOT EXISTS "Showcase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "cols" INTEGER NOT NULL DEFAULT 3,
    "rows" INTEGER NOT NULL DEFAULT 3,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Showcase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Showcase_userId_sortOrder_idx" ON "Showcase"("userId", "sortOrder");

-- CreateTable: carte placée dans un classeur
CREATE TABLE IF NOT EXISTS "ShowcaseItem" (
    "id" TEXT NOT NULL,
    "showcaseId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 0,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowcaseItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShowcaseItem_showcaseId_page_slot_key" ON "ShowcaseItem"("showcaseId", "page", "slot");
CREATE UNIQUE INDEX IF NOT EXISTS "ShowcaseItem_showcaseId_collectionItemId_key" ON "ShowcaseItem"("showcaseId", "collectionItemId");
CREATE INDEX IF NOT EXISTS "ShowcaseItem_showcaseId_idx" ON "ShowcaseItem"("showcaseId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Showcase" ADD CONSTRAINT "Showcase_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_showcaseId_fkey"
        FOREIGN KEY ("showcaseId") REFERENCES "Showcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ShowcaseItem" ADD CONSTRAINT "ShowcaseItem_collectionItemId_fkey"
        FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
