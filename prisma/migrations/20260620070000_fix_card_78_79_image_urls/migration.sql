-- Corrige les imageUrl des cartes 78-79 après conversion PNG → JPEG (commit 82e8781).
UPDATE "Card"
SET "imageUrl" = '78_TOYOTA_COROLLA_AE86_LEVIN_POCKET_DRIFTER.jpg'
WHERE "number" = 78
  AND "imageUrl" = '78_TOYOTA_COROLLA_AE86_LEVIN_POCKET_DRIFTER.png';

UPDATE "Card"
SET "imageUrl" = '79_MAZDA_SAVANNA_RX7_FB_UNIQUE.jpg'
WHERE "number" = 79
  AND "imageUrl" = '79_MAZDA_SAVANNA_RX7_FB_UNIQUE.png';
