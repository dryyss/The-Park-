/** Règles portefeuille crédits marketplace. */
export const WALLET_MIN_TOP_UP_EUR = 5;
export const WALLET_TOP_UP_FEE_PCT = 0.05;
/** Montant minimum de retrait bancaire (gains vendeur). */
export const WALLET_MIN_WITHDRAW_EUR = 5;

export interface WalletTopUpQuote {
  creditEur: number;
  feeEur: number;
  totalChargeEur: number;
}

/** Calcule le montant Stripe : crédit demandé + 5 % de frais en supplément. */
export function quoteWalletTopUp(creditEur: number): WalletTopUpQuote {
  const credit = roundEur(creditEur);
  const fee = roundEur(credit * WALLET_TOP_UP_FEE_PCT);
  return {
    creditEur: credit,
    feeEur: fee,
    totalChargeEur: roundEur(credit + fee),
  };
}

export function roundEur(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatWalletEur(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** État onboarding Stripe Connect vendeur (partagé client/serveur). */
export interface WalletConnectStatus {
  hasAccount: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}
