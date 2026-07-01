/**
 * Flags de fonctionnalités — activent/désactivent des modules entiers du produit.
 *
 * `exchange` : système d'échange entre membres (troc de cartes). Désactivé pour
 * le moment (fonctionnalité à venir). Remettre à `true` pour le réactiver :
 * cela réaffiche la nav « Échanges », rouvre les routes /echanges et réactive
 * l'option « Échange » à la mise en vente.
 */
export const FEATURES = {
  exchange: false,
} as const;
