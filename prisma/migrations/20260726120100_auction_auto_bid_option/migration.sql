-- ============================================================================
--  Enchère automatique (proxy bidding) — option payante à l'acte
-- ============================================================================
--
-- Les colonnes du proxy bidding (Bid.maxAmount / Bid.isAuto) existaient déjà au
-- schéma sans être ni écrites ni lues. On ajoute ici ce qui manquait pour les
-- exploiter : le droit d'armer un plafond, vendu par enchère, et le rattachement
-- d'une écriture de portefeuille à une enchère.

CREATE TABLE "AuctionAutoBidOption" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feePaid" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionAutoBidOption_pkey" PRIMARY KEY ("id")
);

-- Une seule option par membre et par enchère : le double clic ne facture qu'une
-- fois, et `purchaseAutoBidOption` s'appuie sur cette contrainte comme garde-fou.
CREATE UNIQUE INDEX "AuctionAutoBidOption_auctionId_userId_key"
    ON "AuctionAutoBidOption"("auctionId", "userId");

CREATE INDEX "AuctionAutoBidOption_userId_idx" ON "AuctionAutoBidOption"("userId");

ALTER TABLE "AuctionAutoBidOption"
    ADD CONSTRAINT "AuctionAutoBidOption_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuctionAutoBidOption"
    ADD CONSTRAINT "AuctionAutoBidOption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rattache une écriture de portefeuille à une enchère (achat d'option, puis
-- règlement de la vente au lot suivant).
ALTER TABLE "WalletLedgerEntry" ADD COLUMN "auctionId" TEXT;
