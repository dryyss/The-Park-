import { describe, it, expect } from "vitest";
import { minNextBid } from "@/server/auction/auction.mutations";

describe("minNextBid", () => {
  it("aucune enchère → prix de départ", () => {
    expect(minNextBid(10, 1, null)).toBe(10);
  });

  it("enchère existante → meilleure offre + incrément", () => {
    expect(minNextBid(10, 1, 12)).toBe(13);
    expect(minNextBid(10, 0.5, 12)).toBe(12.5);
  });

  it("l'incrément s'ajoute au top, pas au prix de départ", () => {
    expect(minNextBid(5, 2, 20)).toBe(22);
  });

  it("relève tout pas inférieur au minimum de 0,25 €", () => {
    // Ventes ouvertes avant le passage du pas à 0,25 € : le plancher leur est
    // appliqué à la lecture, sans reprise des données.
    expect(minNextBid(10, 0.1, 80.05)).toBe(80.3);
    expect(minNextBid(10, 0.01, 12)).toBe(12.25);
  });

  it("laisse intact un pas déjà supérieur au minimum", () => {
    expect(minNextBid(10, 0.5, 12)).toBe(12.5);
  });

  it("arrondit au centime — le plancher ne doit pas traîner de reste flottant", () => {
    expect(minNextBid(10, 0.25, 80.05)).toBe(80.3);
  });
});
