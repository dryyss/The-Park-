-- Pas de mise minimum porté de 0,10 € à 0,25 €.
--
-- Seul le défaut de colonne change ici. Le plancher applicable aux ventes déjà
-- ouvertes est appliqué à la lecture (`minNextBid`, `placeBid`), pas en base :
-- l'enchère garde le pas sous lequel elle a été publiée, et c'est le code qui
-- refuse d'aller en dessous du minimum. Réécrire les lignes existantes
-- modifierait rétroactivement les conditions annoncées aux enchérisseurs.

ALTER TABLE "Auction" ALTER COLUMN "bidIncrement" SET DEFAULT 0.25;
