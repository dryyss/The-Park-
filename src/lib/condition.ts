// États d'une carte (CardCondition Prisma). Couleurs partagées ; libellés via i18n
// (namespace "conditions"), pour rester conforme à la règle i18n (.cursorrules).

export type ConditionCode = "MINT" | "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR" | "DAMAGED";

export const CONDITION_COLORS: Record<ConditionCode, string> = {
  MINT: "#5ED99A",
  EXCELLENT: "#7BE3A8",
  VERY_GOOD: "#4FA3FF",
  GOOD: "#E8B23A",
  FAIR: "#E89A5A",
  DAMAGED: "#FF6B5E",
};

export const CONDITION_ORDER: ConditionCode[] = ["MINT", "EXCELLENT", "VERY_GOOD", "GOOD", "FAIR", "DAMAGED"];

export function conditionColor(code: string): string {
  return CONDITION_COLORS[code as ConditionCode] ?? "#8E8E98";
}
