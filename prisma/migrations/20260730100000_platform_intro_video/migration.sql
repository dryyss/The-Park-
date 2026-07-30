-- Vidéo de présentation affichée sur l'accueil.
--
-- Seule l'URL est stockée : le fichier vit sur Cellar, comme les visuels de
-- cartes. La vignette est séparée pour que la page n'ait à charger aucun octet
-- de vidéo avant que le visiteur clique sur lecture.
--
-- Les deux colonnes sont nullables : tant qu'aucune URL n'est renseignée depuis
-- l'admin, la section reste masquée sur l'accueil.

ALTER TABLE "PlatformConfig" ADD COLUMN "introVideoUrl" TEXT;
ALTER TABLE "PlatformConfig" ADD COLUMN "introVideoPosterUrl" TEXT;
