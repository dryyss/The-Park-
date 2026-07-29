/**
 * Règles d'enchère partagées entre le serveur et le formulaire de mise.
 *
 * `auction.mutations.ts` porte `server-only` : les composants client ne peuvent
 * pas y puiser leurs constantes. Elles vivent donc ici, en un seul endroit, pour
 * que le pas affiché dans le formulaire soit exactement celui que le serveur
 * fait respecter.
 */

/**
 * Pas minimum imposé sur toute enchère : 25 centimes.
 *
 * Ce plancher s'applique aussi aux ventes créées avec un pas plus fin — il est
 * appliqué à la lecture (cf. `minNextBid`), sans reprise des données existantes.
 */
export const MIN_BID_INCREMENT_EUR = 0.25;
