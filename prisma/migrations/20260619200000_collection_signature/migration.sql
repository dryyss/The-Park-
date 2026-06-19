-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN "isSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollectionItem" ADD COLUMN "signatureAuthor" TEXT;
