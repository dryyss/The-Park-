-- AlterTable: marque / constructeur de la carte (badges de collection par marque)
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "brand" TEXT;
