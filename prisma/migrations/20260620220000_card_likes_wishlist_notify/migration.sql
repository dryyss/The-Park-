-- CreateTable
CREATE TABLE "CardLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardLike_cardId_idx" ON "CardLike"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardLike_userId_cardId_key" ON "CardLike"("userId", "cardId");

-- AddForeignKey
ALTER TABLE "CardLike" ADD CONSTRAINT "CardLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardLike" ADD CONSTRAINT "CardLike_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WISHLIST_LISTING';
