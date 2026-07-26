import { describe, it, expect } from "vitest";
import { resolveProxyDuel } from "@/server/auction/auction.mutations";

/** Raccourci : l'incrément vaut 1 € sauf mention contraire. */
const duel = (input: {
  challengerBid: number;
  challengerMax: number;
  incumbentMax: number | null;
  increment?: number;
}) => resolveProxyDuel({ increment: input.increment ?? 1, ...input });

describe("resolveProxyDuel", () => {
  it("sans leader en place, le challenger mène à sa saisie et non à son plafond", () => {
    const r = duel({ challengerBid: 10, challengerMax: 250, incumbentMax: null });
    expect(r.leader).toBe("challenger");
    expect(r.leadPrice).toBe(10);
    expect(r.challengerAmount).toBe(10);
    expect(r.incumbentAutoAmount).toBeNull();
  });

  it("plafond supérieur : le challenger passe devant au minimum nécessaire", () => {
    const r = duel({ challengerBid: 21, challengerMax: 250, incumbentMax: 100 });
    expect(r.leader).toBe("challenger");
    // 100 + 1, et surtout pas 250 : on ne consomme pas le plafond du gagnant.
    expect(r.leadPrice).toBe(101);
    expect(r.challengerAmount).toBe(101);
    // Le leader déchu est monté jusqu'à son plafond en résistant.
    expect(r.incumbentAutoAmount).toBe(100);
  });

  it("plafond inférieur : le leader tient au minimum nécessaire", () => {
    const r = duel({ challengerBid: 30, challengerMax: 80, incumbentMax: 250 });
    expect(r.leader).toBe("incumbent");
    expect(r.leadPrice).toBe(81);
    // Le perdant a réellement engagé son plafond : sa mise est inscrite à 80.
    expect(r.challengerAmount).toBe(80);
    expect(r.incumbentAutoAmount).toBe(81);
  });

  it("à égalité de plafond, l'antériorité l'emporte", () => {
    const r = duel({ challengerBid: 50, challengerMax: 120, incumbentMax: 120 });
    expect(r.leader).toBe("incumbent");
    // Le leader ne peut pas dépasser son propre plafond pour se défendre.
    expect(r.leadPrice).toBe(120);
    expect(r.challengerAmount).toBe(120);
  });

  it("le leader plafonné ne monte jamais au-dessus de son maximum", () => {
    const r = duel({ challengerBid: 99, challengerMax: 99, incumbentMax: 100 });
    expect(r.leader).toBe("incumbent");
    expect(r.leadPrice).toBe(100);
    expect(r.incumbentAutoAmount).toBe(100);
  });

  it("le prix ne descend jamais sous la saisie du challenger vainqueur", () => {
    // Saisie volontairement haute alors que le leader est bas : on respecte la saisie.
    const r = duel({ challengerBid: 200, challengerMax: 250, incumbentMax: 20 });
    expect(r.leader).toBe("challenger");
    expect(r.leadPrice).toBe(200);
  });

  it("un challenger sans enchère auto est traité comme un plafond égal à sa mise", () => {
    const r = duel({ challengerBid: 150, challengerMax: 150, incumbentMax: 100 });
    expect(r.leader).toBe("challenger");
    expect(r.leadPrice).toBe(150);
  });

  it("respecte un incrément décimal sans traînée de flottant", () => {
    const r = duel({ challengerBid: 10.2, challengerMax: 250, incumbentMax: 10.1, increment: 0.1 });
    expect(r.leader).toBe("challenger");
    // 10.1 + 0.1 vaut 10.200000000000001 en flottant brut.
    expect(r.leadPrice).toBe(10.2);
  });

  it("le duel converge : deux plafonds proches ne produisent pas de surenchère infinie", () => {
    const r = duel({ challengerBid: 100, challengerMax: 100.5, incumbentMax: 100.4, increment: 1 });
    expect(r.leader).toBe("challenger");
    // incumbentMax + increment dépasserait le plafond du challenger : on s'y arrête.
    expect(r.leadPrice).toBe(100.5);
    expect(r.leadPrice).toBeLessThanOrEqual(100.5);
  });
});
