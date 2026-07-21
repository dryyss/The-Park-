-- Code de série (initiales, ex: "MF" pour Moteur Forgé) affiché sur les cartes.
-- Combiné au chiffre d'édition : MF1 = 1ère édition, MF2 = réédition. Sert à
-- identifier/séparer les cartes et à filtrer la recherche du garage.
ALTER TABLE "Season" ADD COLUMN "seriesCode" TEXT;
