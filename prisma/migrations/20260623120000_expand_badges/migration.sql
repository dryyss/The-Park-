-- Nouveaux badges + descriptions mises à jour
INSERT INTO "Badge" ("id", "code", "label", "description")
VALUES
  ('badge_collector_25', 'collector_25', 'Collectionneur', 'Posséder 25 cartes différentes dans le classeur'),
  ('badge_legendary_owner', 'legendary_owner', 'Légendaire', 'Posséder une carte légendaire'),
  ('badge_ultra_rare_owner', 'ultra_rare_owner', 'Ultra rare', 'Posséder une carte ultra rare'),
  ('badge_exchange_veteran', 'exchange_veteran', 'Vétéran des échanges', 'Réaliser 5 échanges complétés'),
  ('badge_first_listing', 'first_listing', 'Première annonce', 'Publier sa première annonce sur la marketplace'),
  ('badge_first_sale', 'first_sale', 'Première vente', 'Réaliser sa première vente marketplace'),
  ('badge_first_purchase', 'first_purchase', 'Premier achat', 'Effectuer son premier achat marketplace'),
  ('badge_wallet_pioneer', 'wallet_pioneer', 'Portefeuille activé', 'Effectuer sa première recharge de crédits')
ON CONFLICT ("code") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description";

UPDATE "Badge" SET "description" = 'Réaliser son premier échange ou sa première vente' WHERE "code" = 'first_trade';
UPDATE "Badge" SET "description" = 'Compléter la Saison 1 à 100 %' WHERE "code" = 'full_season';
