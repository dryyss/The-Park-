-- Pas d'enchère par défaut ramené à 10 centimes (au lieu de 1 €).
ALTER TABLE "Auction" ALTER COLUMN "bidIncrement" SET DEFAULT 0.1;
