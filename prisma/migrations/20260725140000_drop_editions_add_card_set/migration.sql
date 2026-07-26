-- ============================================================================
--  Retrait du système « 1ère édition / réédition » + introduction des collections
-- ============================================================================
--
-- L'édition était portée à trois endroits (CardVariant.editionLabel,
-- CollectionItem.editionLabel/editionPreset, WishlistItem.editionPreset) et
-- entrait dans trois clés d'unicité. Une même carte réelle se retrouvait donc
-- scindée en deux variantes et deux piles de possession, d'où des ajouts qui
-- « disparaissaient » d'un onglet à l'autre.
--
-- On y substitue la collection (CardSet) : un regroupement éditorial porté par
-- la VARIANTE et non par la carte, ce qui permet à une sortie de piocher des
-- cartes de plusieurs saisons.
--
-- Migration non destructive : les doublons créés par l'ancienne modélisation
-- sont fusionnés (quantités additionnées, photos et emplacements de classeur
-- reportés) avant le rétrécissement des contraintes.

-- ────────────────────────────────────────────────────────────────────────────
--  1. Collections
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "CardSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seriesCode" TEXT,
    "releaseDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardSet_code_key" ON "CardSet"("code");

ALTER TABLE "CardVariant" ADD COLUMN "setId" TEXT;

CREATE INDEX "CardVariant_setId_idx" ON "CardVariant"("setId");

ALTER TABLE "CardVariant"
  ADD CONSTRAINT "CardVariant_setId_fkey"
  FOREIGN KEY ("setId") REFERENCES "CardSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
--  2. Relâchement des contraintes avant fusion
-- ────────────────────────────────────────────────────────────────────────────
-- Les index uniques portent encore l'édition : les repointages de l'étape 3
-- créeraient des collisions transitoires. On les retire d'abord, on refera les
-- versions rétrécies à l'étape 6, une fois les données dédupliquées.

DROP INDEX IF EXISTS "CardVariant_cardId_versionTypeId_language_editionLabel_key";
DROP INDEX IF EXISTS "CollectionItem_userId_variantId_condition_editionPreset_key";
DROP INDEX IF EXISTS "WishlistItem_userId_variantId_condition_editionPreset_key";

-- ────────────────────────────────────────────────────────────────────────────
--  3. Fusion des variantes jumelles (1ère édition + réédition d'une même carte)
-- ────────────────────────────────────────────────────────────────────────────

-- Variante conservée pour chaque (carte, version, langue). On privilégie celle
-- qui porte un visuel — le perdre reviendrait à afficher le rendu générique de
-- la carte — puis la variante sans libellé d'édition (la carte de base).
CREATE TEMPORARY TABLE "_variant_keep" AS
SELECT DISTINCT ON ("cardId", "versionTypeId", "language")
       "cardId", "versionTypeId", "language", "id" AS "keepId"
FROM "CardVariant"
ORDER BY "cardId", "versionTypeId", "language",
         ("imageUrl" IS NULL), ("editionLabel" IS NOT NULL), "id";

CREATE TEMPORARY TABLE "_variant_merge" AS
SELECT v."id" AS "dupId", k."keepId"
FROM "CardVariant" v
JOIN "_variant_keep" k
  ON k."cardId" = v."cardId"
 AND k."versionTypeId" = v."versionTypeId"
 AND k."language" = v."language"
WHERE v."id" <> k."keepId";

CREATE INDEX "_variant_merge_dup_idx" ON "_variant_merge"("dupId");

-- Le visuel d'une variante absorbée alimente la conservée si celle-ci n'en a pas.
UPDATE "CardVariant" keep
SET "imageUrl" = src."imageUrl"
FROM (
  SELECT DISTINCT ON (m."keepId") m."keepId", v."imageUrl"
  FROM "_variant_merge" m
  JOIN "CardVariant" v ON v."id" = m."dupId"
  WHERE v."imageUrl" IS NOT NULL
  ORDER BY m."keepId", v."id"
) src
WHERE keep."id" = src."keepId" AND keep."imageUrl" IS NULL;

-- Report de toutes les références vers la variante conservée.
UPDATE "CollectionItem" t SET "variantId" = m."keepId" FROM "_variant_merge" m WHERE t."variantId" = m."dupId";
UPDATE "WishlistItem"   t SET "variantId" = m."keepId" FROM "_variant_merge" m WHERE t."variantId" = m."dupId";
UPDATE "Listing"        t SET "variantId" = m."keepId" FROM "_variant_merge" m WHERE t."variantId" = m."dupId";
UPDATE "Auction"        t SET "variantId" = m."keepId" FROM "_variant_merge" m WHERE t."variantId" = m."dupId";
UPDATE "ExchangeItem"   t SET "variantId" = m."keepId" FROM "_variant_merge" m WHERE t."variantId" = m."dupId";

DELETE FROM "CardVariant" v USING "_variant_merge" m WHERE v."id" = m."dupId";

-- ────────────────────────────────────────────────────────────────────────────
--  4. Fusion des exemplaires possédés en doublon
-- ────────────────────────────────────────────────────────────────────────────

-- Ligne conservée par (membre, variante, état) : la plus fournie d'abord, puis
-- la plus ancienne — c'est elle qui porte l'historique d'acquisition.
CREATE TEMPORARY TABLE "_item_keep" AS
SELECT DISTINCT ON ("userId", "variantId", "condition")
       "userId", "variantId", "condition", "id" AS "keepId"
FROM "CollectionItem"
ORDER BY "userId", "variantId", "condition", "quantity" DESC, "acquiredAt", "id";

CREATE TEMPORARY TABLE "_item_merge" AS
SELECT c."id" AS "dupId", k."keepId"
FROM "CollectionItem" c
JOIN "_item_keep" k
  ON k."userId" = c."userId"
 AND k."variantId" = c."variantId"
 AND k."condition" = c."condition"
WHERE c."id" <> k."keepId";

CREATE INDEX "_item_merge_dup_idx" ON "_item_merge"("dupId");

-- Quantités additionnées : les deux piles décrivaient le même couple
-- (carte, état), leurs exemplaires sont bien cumulatifs. Les réservations
-- suivent, sans quoi une annonce en cours perdrait sa garantie de possession.
UPDATE "CollectionItem" keep
SET "quantity"         = keep."quantity" + agg."quantity",
    "reservedQuantity" = keep."reservedQuantity" + agg."reservedQuantity",
    "forTrade"         = keep."forTrade" OR agg."forTrade",
    "forSale"          = keep."forSale" OR agg."forSale",
    "note"             = COALESCE(keep."note", agg."note"),
    "acquiredAt"       = LEAST(keep."acquiredAt", agg."acquiredAt")
FROM (
  SELECT m."keepId",
         SUM(c."quantity")         AS "quantity",
         SUM(c."reservedQuantity") AS "reservedQuantity",
         BOOL_OR(c."forTrade")     AS "forTrade",
         BOOL_OR(c."forSale")      AS "forSale",
         MIN(c."note")             AS "note",
         MIN(c."acquiredAt")       AS "acquiredAt"
  FROM "_item_merge" m
  JOIN "CollectionItem" c ON c."id" = m."dupId"
  GROUP BY m."keepId"
) agg
WHERE keep."id" = agg."keepId";

-- Gradation et signature : la ligne conservée hérite de l'attribut si elle ne
-- le portait pas — perdre une gradation PSA à la fusion serait irréversible.
UPDATE "CollectionItem" keep
SET "isGraded"     = TRUE,
    "gradeCompany" = COALESCE(keep."gradeCompany", src."gradeCompany"),
    "gradeScore"   = COALESCE(keep."gradeScore", src."gradeScore")
FROM (
  SELECT DISTINCT ON (m."keepId") m."keepId", c."gradeCompany", c."gradeScore"
  FROM "_item_merge" m
  JOIN "CollectionItem" c ON c."id" = m."dupId"
  WHERE c."isGraded" = TRUE
  ORDER BY m."keepId", c."gradeScore" DESC NULLS LAST, c."id"
) src
WHERE keep."id" = src."keepId" AND keep."isGraded" = FALSE;

UPDATE "CollectionItem" keep
SET "isSigned"        = TRUE,
    "signatureAuthor" = COALESCE(keep."signatureAuthor", src."signatureAuthor")
FROM (
  SELECT DISTINCT ON (m."keepId") m."keepId", c."signatureAuthor"
  FROM "_item_merge" m
  JOIN "CollectionItem" c ON c."id" = m."dupId"
  WHERE c."isSigned" = TRUE
  ORDER BY m."keepId", c."id"
) src
WHERE keep."id" = src."keepId" AND keep."isSigned" = FALSE;

-- Les photos suivent l'exemplaire : sans report, la suppression de la ligne
-- source les emporterait en cascade.
UPDATE "CollectionItemPhoto" p
SET "collectionItemId" = m."keepId"
FROM "_item_merge" m
WHERE p."collectionItemId" = m."dupId";

-- Emplacements de classeur : un même classeur ne peut référencer deux fois la
-- ligne conservée (@@unique([showcaseId, collectionItemId])). On libère d'abord
-- les emplacements qui feraient doublon, puis on reporte les autres.
DELETE FROM "ShowcaseItem" s
USING "_item_merge" m
WHERE s."collectionItemId" = m."dupId"
  AND EXISTS (
    SELECT 1 FROM "ShowcaseItem" other
    WHERE other."showcaseId" = s."showcaseId"
      AND other."collectionItemId" = m."keepId"
  );

UPDATE "ShowcaseItem" s
SET "collectionItemId" = m."keepId"
FROM "_item_merge" m
WHERE s."collectionItemId" = m."dupId";

DELETE FROM "CollectionItem" c USING "_item_merge" m WHERE c."id" = m."dupId";

-- ────────────────────────────────────────────────────────────────────────────
--  5. Fusion des recherches (wishlist) en doublon
-- ────────────────────────────────────────────────────────────────────────────

CREATE TEMPORARY TABLE "_wish_keep" AS
SELECT DISTINCT ON ("userId", "variantId", "condition")
       "userId", "variantId", "condition", "id" AS "keepId"
FROM "WishlistItem"
ORDER BY "userId", "variantId", "condition", "createdAt", "id";

CREATE TEMPORARY TABLE "_wish_merge" AS
SELECT w."id" AS "dupId", k."keepId"
FROM "WishlistItem" w
JOIN "_wish_keep" k
  ON k."userId" = w."userId"
 AND k."variantId" = w."variantId"
 AND k."condition" = w."condition"
WHERE w."id" <> k."keepId";

-- Alerte prix : on retient le seuil le plus bas des deux recherches, celui qui
-- déclenche en dernier — supprimer l'alerte serait une perte de service.
UPDATE "WishlistItem" keep
SET "alertPrice" = LEAST(COALESCE(keep."alertPrice", agg."alertPrice"), COALESCE(agg."alertPrice", keep."alertPrice")),
    "note"       = COALESCE(keep."note", agg."note")
FROM (
  SELECT m."keepId", MIN(w."alertPrice") AS "alertPrice", MIN(w."note") AS "note"
  FROM "_wish_merge" m
  JOIN "WishlistItem" w ON w."id" = m."dupId"
  GROUP BY m."keepId"
) agg
WHERE keep."id" = agg."keepId";

DELETE FROM "WishlistItem" w USING "_wish_merge" m WHERE w."id" = m."dupId";

-- ────────────────────────────────────────────────────────────────────────────
--  6. Retrait des colonnes d'édition et contraintes définitives
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE "CardVariant"    DROP COLUMN "editionLabel";
ALTER TABLE "CollectionItem" DROP COLUMN "editionLabel";
ALTER TABLE "CollectionItem" DROP COLUMN "editionPreset";
ALTER TABLE "WishlistItem"   DROP COLUMN "editionPreset";

CREATE UNIQUE INDEX "CardVariant_cardId_versionTypeId_language_setId_key"
  ON "CardVariant"("cardId", "versionTypeId", "language", "setId");

CREATE UNIQUE INDEX "CollectionItem_userId_variantId_condition_key"
  ON "CollectionItem"("userId", "variantId", "condition");

CREATE UNIQUE INDEX "WishlistItem_userId_variantId_condition_key"
  ON "WishlistItem"("userId", "variantId", "condition");

DROP TABLE "_variant_keep", "_variant_merge", "_item_keep", "_item_merge", "_wish_keep", "_wish_merge";
