-- Wishlist : variante, saison, état et édition recherchés (plus une entrée vague par carte).

ALTER TABLE "WishlistItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "WishlistItem" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "WishlistItem" ADD COLUMN "condition" "CardCondition" NOT NULL DEFAULT 'EXCELLENT';
ALTER TABLE "WishlistItem" ADD COLUMN "editionPreset" TEXT NOT NULL DEFAULT 'unlimited';

UPDATE "WishlistItem" wi
SET "variantId" = (
  SELECT cv.id
  FROM "CardVariant" cv
  WHERE cv."cardId" = wi."cardId"
  ORDER BY cv.id
  LIMIT 1
);

UPDATE "WishlistItem" wi
SET "seasonId" = (
  SELECT c."seasonId" FROM "Card" c WHERE c.id = wi."cardId"
);

DELETE FROM "WishlistItem" WHERE "variantId" IS NULL OR "seasonId" IS NULL;

ALTER TABLE "WishlistItem" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "WishlistItem" ALTER COLUMN "seasonId" SET NOT NULL;

DROP INDEX IF EXISTS "WishlistItem_userId_cardId_key";

CREATE UNIQUE INDEX "WishlistItem_userId_variantId_condition_editionPreset_key"
  ON "WishlistItem"("userId", "variantId", "condition", "editionPreset");

CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

ALTER TABLE "WishlistItem"
  ADD CONSTRAINT "WishlistItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "CardVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WishlistItem"
  ADD CONSTRAINT "WishlistItem_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
