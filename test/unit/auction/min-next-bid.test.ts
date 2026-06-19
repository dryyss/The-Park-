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
});
