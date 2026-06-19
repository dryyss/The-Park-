-- CreateTable
CREATE TABLE "CollectionItemPhoto" (
    "id" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItemPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionItemPhoto_collectionItemId_sortOrder_idx" ON "CollectionItemPhoto"("collectionItemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CollectionItemPhoto" ADD CONSTRAINT "CollectionItemPhoto_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
