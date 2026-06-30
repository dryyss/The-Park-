-- AlterTable: pays d'origine déclaré de l'utilisateur (code ISO-3166-1 alpha-2)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;
