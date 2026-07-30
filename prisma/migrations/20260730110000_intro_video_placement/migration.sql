-- Placement de la vidéo de présentation : plein écran à la première visite
-- (« intro ») ou bloc dans la page d'accueil (« section »).
--
-- Réglable depuis l'admin plutôt que codé en dur : le choix est éditorial et
-- se rediscute sans redéploiement.
ALTER TABLE "PlatformConfig" ADD COLUMN "introVideoPlacement" TEXT NOT NULL DEFAULT 'intro';
