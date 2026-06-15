// Formatage partagé (pur module, utilisable client/serveur).

/** Prix en euros, format français : 19,90 €. Accepte number/string/Decimal Prisma. */
export function formatPrice(value: unknown): string {
  const n = value == null ? 0 : Number((value as { toString(): string }).toString());
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(n) ? n : 0);
}

/** Pourcentage entier : 0.92 -> "92 %", 92 -> "92 %". */
export function formatPercent(ratio: number, alreadyPercent = false): string {
  const pct = alreadyPercent ? ratio : ratio * 100;
  return `${Math.round(pct)} %`;
}
