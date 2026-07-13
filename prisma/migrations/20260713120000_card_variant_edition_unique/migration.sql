-- L'édition devient partie intégrante de la clé d'unicité d'une variante :
-- une même carte peut exister en « 1ère édition » ET en réédition sur la même
-- version/langue (même numéro de série, édition différente). Sans ce changement,
-- ajouter une réédition à côté d'une 1ère édition était rejeté (VARIANT_EXISTS).
DROP INDEX "CardVariant_cardId_versionTypeId_language_key";

CREATE UNIQUE INDEX "CardVariant_cardId_versionTypeId_language_editionLabel_key" ON "CardVariant"("cardId", "versionTypeId", "language", "editionLabel");
