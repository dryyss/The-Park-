-- ============================================================================
--  Règlement des enchères — la vente adjugée entre dans le cycle marketplace
-- ============================================================================
--
-- `settleDueAuctions` désignait un gagnant sans rien encaisser : ni Sale, ni
-- Payment, ni débit. On rattache désormais chaque enchère adjugée à une vente,
-- ce qui lui fait hériter de l'expédition, de la garantie, des litiges et du
-- versement vendeur — commission comprise (Payment.applicationFee).
--
-- `listingId` reste obligatoire sur Sale : la clôture crée une annonce de
-- règlement (statut SOLD, donc jamais listée publiquement) plutôt que de rendre
-- la relation optionnelle, ce qui aurait touché la soixantaine de lectures de
-- `sale.listing` existantes.

ALTER TABLE "Sale" ADD COLUMN "auctionId" TEXT;

-- Une enchère ne se règle qu'une fois : c'est cette contrainte qui rend
-- `settleAuctionSale` idempotent face aux passages répétés du cron.
CREATE UNIQUE INDEX "Sale_auctionId_key" ON "Sale"("auctionId");

ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
