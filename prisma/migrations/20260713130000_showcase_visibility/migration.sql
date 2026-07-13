-- Visibilité par classeur : PUBLIC (défaut) / FRIENDS (amis acceptés) / PRIVATE.
ALTER TYPE "Visibility" ADD VALUE IF NOT EXISTS 'FRIENDS';

ALTER TABLE "Showcase" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';
