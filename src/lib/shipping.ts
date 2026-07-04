import type { ShippingMode } from "@/generated/prisma/client";

/** Définition d'un mode d'envoi C2C proposé à l'acheteur au checkout. */
export interface ShippingModeDef {
  code: ShippingMode;
  /** Frais ajoutés au total, en euros (par vendeur — chaque vendeur expédie son colis). */
  feeEur: number;
  /** Estimation de délai (clé i18n shipping.eta.<code>). */
  sortOrder: number;
  /** Proposé au choix de l'acheteur (STANDARD est un alias hérité, non proposé). */
  selectable: boolean;
}

export const SHIPPING_MODE_DEFS: ShippingModeDef[] = [
  { code: "HAND_DELIVERY", feeEur: 0, sortOrder: 0, selectable: true },
  { code: "LETTER_TRACKED", feeEur: 2.9, sortOrder: 1, selectable: true },
  { code: "PICKUP_POINT", feeEur: 4.5, sortOrder: 2, selectable: true },
  { code: "COLISSIMO", feeEur: 5.9, sortOrder: 3, selectable: true },
  { code: "SECURED", feeEur: 9.9, sortOrder: 4, selectable: true },
  { code: "STANDARD", feeEur: 2.9, sortOrder: 5, selectable: false },
];

const BY_CODE = new Map(SHIPPING_MODE_DEFS.map((d) => [d.code, d]));

/** Modes proposés au checkout, dans l'ordre d'affichage. */
export const SELECTABLE_SHIPPING_MODES = SHIPPING_MODE_DEFS.filter((d) => d.selectable).sort(
  (a, b) => a.sortOrder - b.sortOrder,
);

export function isSelectableShippingMode(code: string): code is ShippingMode {
  return SELECTABLE_SHIPPING_MODES.some((d) => d.code === code);
}

/** Frais de port d'un mode (0 si inconnu — remise en main propre par défaut). */
export function shippingFeeEur(code: ShippingMode): number {
  return BY_CODE.get(code)?.feeEur ?? 0;
}

/** La remise en main propre n'a ni transporteur ni numéro de suivi. */
export function isHandDelivery(code: ShippingMode): boolean {
  return code === "HAND_DELIVERY";
}
