-- Écriture au grand livre pour l'achat de l'option « enchère automatique ».
-- Isolée dans sa propre migration : Postgres interdit d'utiliser une valeur d'enum
-- dans la transaction qui l'ajoute (cf. 20260725160000 / 20260725170000).
ALTER TYPE "WalletEntryType" ADD VALUE IF NOT EXISTS 'AUCTION_OPTION';
