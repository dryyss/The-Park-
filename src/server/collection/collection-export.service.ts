import "server-only";
import { prisma } from "@/lib/prisma";

export interface CollectionExportRow {
  seasonCode: string;
  seasonName: string;
  number: number;
  name: string;
  rarity: string;
  version: string;
  language: string;
  condition: string;
  edition: string;
  quantity: number;
  graded: string;
  signed: string;
  quoteValue: number;
}

/** Lignes à plat de la collection d'un membre — base des exports CSV / JSON. */
export async function getCollectionExportRows(userId: string): Promise<CollectionExportRow[]> {
  const items = await prisma.collectionItem.findMany({
    where: { userId, quantity: { gt: 0 } },
    select: {
      condition: true,
      quantity: true,
      editionLabel: true,
      isGraded: true,
      gradeCompany: true,
      gradeScore: true,
      isSigned: true,
      variant: {
        select: {
          language: true,
          versionType: { select: { label: true } },
          card: {
            select: {
              number: true,
              name: true,
              quoteValue: true,
              rarity: { select: { label: true } },
              season: { select: { code: true, name: true } },
            },
          },
        },
      },
    },
  });

  return items
    .map((it): CollectionExportRow => {
      const card = it.variant.card;
      return {
        seasonCode: card.season.code,
        seasonName: card.season.name,
        number: card.number,
        name: card.name,
        rarity: card.rarity.label,
        version: it.variant.versionType.label,
        language: it.variant.language,
        condition: it.condition,
        edition: it.editionLabel?.trim() || "Illimitée",
        quantity: it.quantity,
        graded: it.isGraded ? `${it.gradeCompany ?? ""} ${it.gradeScore ?? ""}`.trim() || "Oui" : "",
        signed: it.isSigned ? "Oui" : "",
        quoteValue: Number(card.quoteValue.toString()),
      };
    })
    .sort((a, b) => a.seasonCode.localeCompare(b.seasonCode) || a.number - b.number);
}

const CSV_COLUMNS: { key: keyof CollectionExportRow; header: string }[] = [
  { key: "seasonCode", header: "Saison" },
  { key: "number", header: "N°" },
  { key: "name", header: "Carte" },
  { key: "rarity", header: "Rareté" },
  { key: "version", header: "Version" },
  { key: "language", header: "Langue" },
  { key: "condition", header: "État" },
  { key: "edition", header: "Édition" },
  { key: "quantity", header: "Quantité" },
  { key: "graded", header: "Gradée" },
  { key: "signed", header: "Signée" },
  { key: "quoteValue", header: "Cote (€)" },
];

function csvCell(value: string | number): string {
  const s = String(value);
  // Échappement RFC 4180 : guillemets doublés si le champ contient , " ou saut de ligne.
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function collectionRowsToCsv(rows: CollectionExportRow[]): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(";");
  const lines = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c.key])).join(";"));
  // BOM UTF-8 pour qu'Excel ouvre correctement les accents.
  return "﻿" + [header, ...lines].join("\r\n");
}

export function collectionRowsToJson(rows: CollectionExportRow[]): string {
  const total = rows.reduce((s, r) => s + r.quantity, 0);
  const value = rows.reduce((s, r) => s + r.quoteValue * r.quantity, 0);
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), totalCards: total, estimatedValue: Math.round(value * 100) / 100, items: rows },
    null,
    2,
  );
}
