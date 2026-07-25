-- L'édition devient partie intégrante de l'identité d'un exemplaire possédé.
--
-- Avant : @@unique([userId, variantId, condition]). Un membre possédant la même
-- carte en 1ère édition ET en réédition, dans le même état, ne disposait que
-- d'une seule ligne : l'ajout depuis l'onglet « 1ère édition » incrémentait la
-- pile réédition, et la carte restait affichée comme manquante sur cet onglet.
--
-- `editionPreset` reprend la convention déjà en place sur WishlistItem
-- ("first" | "unlimited") : colonne non nulle, donc utilisable dans un index
-- unique (contrairement à `editionLabel`, nullable, où Postgres ne déduplique pas).

ALTER TABLE "CollectionItem" ADD COLUMN "editionPreset" TEXT NOT NULL DEFAULT 'unlimited';

-- Reprise de l'existant : tout libellé désignant une 1ère édition bascule sur
-- le preset correspondant. Les libellés vides/absents restent en « unlimited »,
-- ce qui correspond au comportement de resolveEditionLabel() côté application.
UPDATE "CollectionItem"
SET "editionPreset" = 'first'
WHERE "editionLabel" IS NOT NULL
  AND (
    lower("editionLabel") LIKE '1ère%'
    OR lower("editionLabel") LIKE '1ere%'
    OR lower("editionLabel") LIKE '1re %'
    OR lower("editionLabel") LIKE '1re'
    OR lower("editionLabel") = '1st'
    OR lower("editionLabel") LIKE 'first edition%'
  );

-- Relâchement de contrainte : toute ligne unique sur (userId, variantId, condition)
-- l'est a fortiori sur le quadruplet. Aucune donnée existante ne peut entrer en
-- conflit, la bascule est donc sûre sans déduplication préalable.
DROP INDEX "CollectionItem_userId_variantId_condition_key";

CREATE UNIQUE INDEX "CollectionItem_userId_variantId_condition_editionPreset_key"
  ON "CollectionItem"("userId", "variantId", "condition", "editionPreset");
