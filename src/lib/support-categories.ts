/** Catégories de ticket support — module partagé client/serveur (pas de server-only). */
export const TICKET_CATEGORIES = ["GENERAL", "ORDER", "PAYMENT", "MODERATION", "BUG", "OTHER"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
