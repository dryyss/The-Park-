/** Code saison dédiée aux cartes hors numérotation de set (promos isolées, collabs, etc.). */
export const HORS_SERIE_SEASON_CODE = "HS";

export function isHorsSerieSeasonCode(code: string): boolean {
  return code === HORS_SERIE_SEASON_CODE;
}

/** Saisons numérotées (S01, S02…), distinctes du bucket hors série. */
export function isNumberedSeasonCode(code: string): boolean {
  return /^S\d+$/i.test(code);
}
