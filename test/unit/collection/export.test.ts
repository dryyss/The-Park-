import { describe, it, expect } from "vitest";
import {
  collectionRowsToCsv,
  collectionRowsToJson,
  type CollectionExportRow,
} from "@/server/collection/collection-export.service";

function row(partial: Partial<CollectionExportRow> = {}): CollectionExportRow {
  return {
    seasonCode: "S01",
    seasonName: "Moteur Forgé",
    number: 1,
    name: "Nissan Silvia",
    rarity: "Rare Holo",
    version: "Standard",
    language: "FR",
    condition: "MINT",
    edition: "1ère édition",
    quantity: 2,
    graded: "",
    signed: "",
    quoteValue: 12.5,
    ...partial,
  };
}

describe("collection export CSV", () => {
  it("commence par un BOM UTF-8 et un en-tête point-virgule", () => {
    const csv = collectionRowsToCsv([row()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Saison;N°;Carte");
  });

  it("échappe les champs contenant un séparateur ou un guillemet", () => {
    const csv = collectionRowsToCsv([row({ name: 'Silvia "S15"; drift' })]);
    // Le champ doit être entre guillemets avec les guillemets internes doublés.
    expect(csv).toContain('"Silvia ""S15""; drift"');
  });

  it("émet une ligne de données par entrée", () => {
    const csv = collectionRowsToCsv([row(), row({ number: 2, name: "Toyota AE86" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // en-tête + 2 lignes
    expect(lines[2]).toContain("Toyota AE86");
  });
});

describe("collection export JSON", () => {
  it("agrège total de cartes et valeur estimée (quantité × cote)", () => {
    const json = JSON.parse(collectionRowsToJson([row({ quantity: 2, quoteValue: 10 }), row({ number: 2, quantity: 1, quoteValue: 5 })]));
    expect(json.totalCards).toBe(3);
    expect(json.estimatedValue).toBe(25); // 2×10 + 1×5
    expect(json.items).toHaveLength(2);
    expect(typeof json.exportedAt).toBe("string");
  });
});
