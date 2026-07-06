/**
 * Jeton du jour anti-réutilisation (« jeton du jour ») — module partagé
 * client/serveur. Format déterministe `TP-YYYYMMDD` (UTC) : il est incrusté dans
 * la vidéo à l'enregistrement et vérifiable par la modération.
 */
export function todayDropToken(date: Date = new Date()): string {
  return `TP-${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}
