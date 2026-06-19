import { describe, it, expect } from "vitest";
import { formatPrice, formatPercent } from "@/lib/format";
import { normalizeProfileSlug } from "@/lib/slug";
import {
  isSpecialRarity,
  isPromoRarity,
  rarityTitle,
  cardNumberLabel,
} from "@/lib/rarities";

// Le format monétaire fr-FR insère une espace insécable (variable selon Node) :
// on compare donc en normalisant les espaces.
const norm = (s: string) => s.replace(/\s/g, " ").trim();

describe("formatPrice", () => {
  it("null → 0,00 €", () => {
    expect(norm(formatPrice(null))).toBe("0,00 €");
    expect(norm(formatPrice(undefined))).toBe("0,00 €");
  });

  it("number et string", () => {
    expect(norm(formatPrice(19.9))).toBe("19,90 €");
    expect(norm(formatPrice("5"))).toBe("5,00 €");
  });

  it("Decimal-like (toString)", () => {
    expect(norm(formatPrice({ toString: () => "12.5" }))).toBe("12,50 €");
  });

  it("valeur non finie → 0,00 €", () => {
    expect(norm(formatPrice("abc"))).toBe("0,00 €");
  });
});

describe("formatPercent", () => {
  it("ratio par défaut", () => {
    expect(formatPercent(0.92)).toBe("92 %");
  });
  it("déjà en pourcentage", () => {
    expect(formatPercent(92, true)).toBe("92 %");
  });
  it("arrondit", () => {
    expect(formatPercent(0.925)).toBe("93 %");
  });
});

describe("normalizeProfileSlug", () => {
  it("retire accents et caractères spéciaux", () => {
    expect(normalizeProfileSlug("Éric Côté!")).toBe("eric-cote");
  });
  it("fusionne les tirets et trim", () => {
    expect(normalizeProfileSlug("  a   b  ")).toBe("a-b");
    expect(normalizeProfileSlug("--x--")).toBe("x");
  });
  it("tronque à 64 caractères", () => {
    expect(normalizeProfileSlug("a".repeat(100)).length).toBe(64);
  });
});

describe("isSpecialRarity / isPromoRarity (legacy 'p')", () => {
  it("codes spéciaux", () => {
    expect(isSpecialRarity("unique")).toBe(true);
    expect(isSpecialRarity("signed")).toBe(true);
    expect(isSpecialRarity("c")).toBe(false);
  });
  it("legacy 'p' compté comme spécial et promo", () => {
    expect(isSpecialRarity("p")).toBe(true);
    expect(isPromoRarity("p")).toBe(true);
    expect(isPromoRarity("promotional")).toBe(true);
    expect(isPromoRarity("c")).toBe(false);
  });
});

describe("cardNumberLabel", () => {
  it("rareté classique → NN/80", () => {
    expect(cardNumberLabel(3, "c")).toBe("03/80");
  });
  it("promo → NN · PROMO", () => {
    expect(cardNumberLabel(0, "promotional")).toBe("00 · PROMO");
  });
  it("spéciale → NN · LABEL", () => {
    expect(cardNumberLabel(7, "unique")).toBe("07 · UNIQUE");
  });
});

describe("rarityTitle", () => {
  it("connu → titre, inconnu → code", () => {
    expect(rarityTitle("g")).toBe("Gold");
    expect(rarityTitle("zzz")).toBe("zzz");
  });
});
