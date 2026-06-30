-- Visuel annonceur optionnel + nouveaux emplacements (top / side) pour les bannières pub.
ALTER TABLE "PromoBanner" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
