/** Documents légaux et réglementaires de The Park. */

export const LEGAL_SLUGS = ["cgv", "cgu", "vendeurs", "confidentialite", "mentions"] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** Glyphe japonais décoratif affiché en filigrane dans l'en-tête. */
export const LEGAL_JP: Record<LegalSlug, string> = {
  cgv: "販売条件",
  cgu: "利用規約",
  vendeurs: "出品規約",
  confidentialite: "個人情報",
  mentions: "法的事項",
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

/** Une section d'un document légal, telle que stockée dans les messages i18n. */
export interface LegalSection {
  /** Titre de la section. */
  h: string;
  /** Paragraphes de texte courant. */
  p?: string[];
  /** Éléments de liste à puces. */
  list?: string[];
}

/** Structure d'un document légal dans le namespace `legal.docs.<slug>`. */
export interface LegalDoc {
  title: string;
  metaDescription: string;
  intro: string;
  sections: LegalSection[];
}
