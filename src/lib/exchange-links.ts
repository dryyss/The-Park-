/** URL de proposition d'échange avec contexte carte / destinataire pré-rempli. */
export function exchangeProposeHref(params: { recipient?: string; card?: string }): string {
  const sp = new URLSearchParams();
  if (params.recipient?.trim()) sp.set("recipient", params.recipient.trim());
  if (params.card?.trim()) sp.set("card", params.card.trim());
  const qs = sp.toString();
  return qs ? `/echanges/proposer?${qs}` : "/echanges/proposer";
}
