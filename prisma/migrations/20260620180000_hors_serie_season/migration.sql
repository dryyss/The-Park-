-- Saison « Hors série » : cartes en dehors des sets S01, S02…
INSERT INTO "Season" (id, code, name, "sortOrder", "createdAt")
SELECT gen_random_uuid()::text, 'HS', 'Hors série', 90, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Season" WHERE code = 'HS');
