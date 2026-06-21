-- Renomme la rareté "Signé" en "Signature" dans la table Rarity
UPDATE "Rarity" SET label = 'Signature' WHERE code = 'signed';
