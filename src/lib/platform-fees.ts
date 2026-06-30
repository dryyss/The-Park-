/** Commission prélevée sur le montant final d'une enchère (0.10 = 10 %). */
export const AUCTION_COMMISSION_RATE = 0.10;

/** Calcule la commission en euros sur un montant donné. */
export function auctionCommission(amountEur: number): number {
  return Math.round(amountEur * AUCTION_COMMISSION_RATE * 100) / 100;
}
