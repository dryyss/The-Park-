/**
 * Transporteurs proposés au vendeur pour renseigner le suivi d'un colis.
 * Ordre d'affichage : les plus utilisés d'abord, « Autre » en dernier.
 * Doit rester aligné sur l'enum Prisma `Carrier`.
 */
export const CARRIERS = [
  "COLISSIMO",
  "LAPOSTE",
  "MONDIAL_RELAY",
  "CHRONOPOST",
  "SHOP2SHOP",
  "RELAIS_COLIS",
  "UPS",
  "DPD",
  "DHL",
  "GLS",
  "FEDEX",
  "TNT",
  "OTHER",
] as const;

export type CarrierCode = (typeof CARRIERS)[number];
