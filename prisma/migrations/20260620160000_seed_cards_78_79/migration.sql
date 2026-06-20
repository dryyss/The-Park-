-- Insère les cartes 78-79 (unique) et leurs CardVariants en production.
-- Le seed Prisma n'est pas relancé automatiquement au déploiement ; cette
-- migration comble le manque de façon idempotente (ON CONFLICT DO NOTHING / DO UPDATE).

DO $$
DECLARE
  v_season_id  TEXT;
  v_rar_unique TEXT;
  v_vt_std     TEXT;
  v_vt_unique  TEXT;
  v_c78        TEXT;
  v_c79        TEXT;
BEGIN
  SELECT id INTO v_season_id FROM "Season"       WHERE code = 'S01';
  SELECT id INTO v_rar_unique FROM "Rarity"      WHERE code = 'unique';
  SELECT id INTO v_vt_std     FROM "VersionType" WHERE code = 'standard';
  SELECT id INTO v_vt_unique  FROM "VersionType" WHERE code = 'unique';

  -- ── Carte 78 ─────────────────────────────────────────────────────────────
  INSERT INTO "Card" (
    id, "seasonId", number, name, slug, "rarityId", "imageUrl",
    "quoteValue", "powerCh", "weightKg", country, description,
    "isUnique", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_season_id, 78,
    'TOYOTA COROLLA AE86 LEVIN POCKET DRIFTER',
    's01-78-toyota-corolla-ae86-levin-pocket-drifter',
    v_rar_unique,
    '78_TOYOTA_COROLLA_AE86_LEVIN_POCKET_DRIFTER.jpg',
    100, 280, 940, 'JP',
    'Édition artistique Pocket Drifter — la légende des montagnes repensée en full drift. Tout en travers !',
    true, NOW(), NOW()
  )
  ON CONFLICT ("seasonId", number) DO UPDATE
    SET "imageUrl" = '78_TOYOTA_COROLLA_AE86_LEVIN_POCKET_DRIFTER.jpg',
        "updatedAt" = NOW();

  SELECT id INTO v_c78 FROM "Card" WHERE "seasonId" = v_season_id AND number = 78;

  -- Variant standard carte 78
  INSERT INTO "CardVariant" (id, "cardId", "versionTypeId", language, "editionLabel")
  VALUES (gen_random_uuid()::text, v_c78, v_vt_std, 'FR'::"Language", 'Pocket Drifter Edition 2023')
  ON CONFLICT ("cardId", "versionTypeId", language) DO NOTHING;

  -- Variant unique carte 78
  IF v_vt_unique IS NOT NULL THEN
    INSERT INTO "CardVariant" (id, "cardId", "versionTypeId", language, "editionLabel")
    VALUES (gen_random_uuid()::text, v_c78, v_vt_unique, 'FR'::"Language", 'Pocket Drifter Edition 2023')
    ON CONFLICT ("cardId", "versionTypeId", language) DO NOTHING;
  END IF;

  -- ── Carte 79 ─────────────────────────────────────────────────────────────
  INSERT INTO "Card" (
    id, "seasonId", number, name, slug, "rarityId", "imageUrl",
    "quoteValue", "powerCh", "weightKg", country, description,
    "isUnique", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_season_id, 79,
    'MAZDA SAVANNA RX-7 FB',
    's01-79-mazda-savanna-rx-7-fb',
    v_rar_unique,
    '79_MAZDA_SAVANNA_RX7_FB_UNIQUE.jpg',
    100, 350, 1050, 'JP',
    'La FB en finition or Moteur Forge — rotatif de légende, silhouette Savanna, unique 01/01.',
    true, NOW(), NOW()
  )
  ON CONFLICT ("seasonId", number) DO UPDATE
    SET "imageUrl" = '79_MAZDA_SAVANNA_RX7_FB_UNIQUE.jpg',
        "updatedAt" = NOW();

  SELECT id INTO v_c79 FROM "Card" WHERE "seasonId" = v_season_id AND number = 79;

  -- Variant standard carte 79
  INSERT INTO "CardVariant" (id, "cardId", "versionTypeId", language, "editionLabel")
  VALUES (gen_random_uuid()::text, v_c79, v_vt_std, 'FR'::"Language", 'Moteur Forge édition 2024')
  ON CONFLICT ("cardId", "versionTypeId", language) DO NOTHING;

  -- Variant unique carte 79
  IF v_vt_unique IS NOT NULL THEN
    INSERT INTO "CardVariant" (id, "cardId", "versionTypeId", language, "editionLabel")
    VALUES (gen_random_uuid()::text, v_c79, v_vt_unique, 'FR'::"Language", 'Moteur Forge édition 2024')
    ON CONFLICT ("cardId", "versionTypeId", language) DO NOTHING;
  END IF;
END $$;
