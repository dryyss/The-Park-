/**
 * Délais du flux sécurisé C2C (ventes marketplace + échanges).
 * Source unique : toute création d'envoi et tout timeout cron doit lire ces valeurs.
 */

/** Délai laissé à l'expéditeur pour déposer le colis. Dépassé → annulation + remboursement. */
export const NOT_SHIP_DAYS = 7;
export const NOT_SHIP_MS = NOT_SHIP_DAYS * 24 * 60 * 60 * 1000;

/** Fenêtre de garantie ouverte à la livraison (signalement d'un problème). */
export const GUARANTEE_HOURS = 72;
export const GUARANTEE_MS = GUARANTEE_HOURS * 60 * 60 * 1000;
