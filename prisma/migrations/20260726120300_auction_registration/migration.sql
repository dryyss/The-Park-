-- ============================================================================
--  Inscription à une enchère — adresse et mode d'envoi déclarés avant de miser
-- ============================================================================
--
-- L'adjudication produisait une vente sans adresse ni mode d'envoi : il fallait
-- les réclamer au gagnant après coup. Le participant les déclare désormais en
-- s'inscrivant, et `placeBid` refuse toute mise sans inscription.
--
-- L'adresse est une RÉFÉRENCE, pas une copie : le membre peut la corriger tant
-- que l'enchère court. Le snapshot immuable est figé sur la vente à la clôture.

CREATE TABLE "AuctionRegistration" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addressId" TEXT,
    "shippingMode" "ShippingMode" NOT NULL,
    "shippingCost" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionRegistration_pkey" PRIMARY KEY ("id")
);

-- Une inscription par membre et par enchère : la ré-inscription corrige le choix
-- existant (upsert) au lieu d'en empiler un second.
CREATE UNIQUE INDEX "AuctionRegistration_auctionId_userId_key"
    ON "AuctionRegistration"("auctionId", "userId");

CREATE INDEX "AuctionRegistration_userId_idx" ON "AuctionRegistration"("userId");
CREATE INDEX "AuctionRegistration_addressId_idx" ON "AuctionRegistration"("addressId");

ALTER TABLE "AuctionRegistration"
    ADD CONSTRAINT "AuctionRegistration_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuctionRegistration"
    ADD CONSTRAINT "AuctionRegistration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- L'adresse peut disparaître du carnet sans invalider l'inscription : le mode
-- d'envoi reste, et la vente conclue porte déjà son propre snapshot.
ALTER TABLE "AuctionRegistration"
    ADD CONSTRAINT "AuctionRegistration_addressId_fkey"
    FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
