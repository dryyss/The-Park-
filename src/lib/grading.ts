/** Sociétés de gradation reconnues (TCG). */
export const GRADE_COMPANIES = [
  { code: "PSA", label: "PSA" },
  { code: "PCA", label: "PCA" },
  { code: "BGS", label: "BGS (Beckett)" },
  { code: "CGC", label: "CGC" },
  { code: "SGC", label: "SGC" },
  { code: "ACE", label: "ACE" },
] as const;

export type GradeCompanyCode = (typeof GRADE_COMPANIES)[number]["code"];

/** Notes usuelles (1 à 10 par pas de 0,5). */
export const GRADE_SCORES: number[] = Array.from({ length: 19 }, (_, i) => 10 - i * 0.5);

export function formatGradeScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace(".", ",");
}

export function isValidGradeCompany(code: string | null | undefined): code is GradeCompanyCode {
  return GRADE_COMPANIES.some((c) => c.code === code);
}
