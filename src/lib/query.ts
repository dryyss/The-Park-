// Helper d'URL générique pour les filtres pilotés par query-string.
// Fusionne les paramètres courants avec un patch, en retirant les valeurs vides.
export function buildHref(
  pathname: string,
  current: Record<string, string | undefined>,
  patch: Record<string, string | undefined>,
): string {
  const merged: Record<string, string | undefined> = { ...current, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
