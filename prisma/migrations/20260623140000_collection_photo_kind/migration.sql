-- Type de photo collection : carte ou certificat de gradation
CREATE TYPE "CollectionPhotoKind" AS ENUM ('CARD', 'CERTIFICATE');

ALTER TABLE "CollectionItemPhoto"
ADD COLUMN "kind" "CollectionPhotoKind" NOT NULL DEFAULT 'CARD';
