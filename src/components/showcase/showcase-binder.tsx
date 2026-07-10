"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShowcaseCard } from "@/components/showcase/showcase-card";
import type { ShowcaseView } from "@/server/showcase/showcase.service";
import { slotsPerPage } from "@/lib/showcase";

/** Affichage public en lecture seule d'un ou plusieurs classeurs du collectionneur. */
export function ShowcaseBinder({ showcases }: { showcases: ShowcaseView[] }) {
  const t = useTranslations("showcase");
  const [activeId, setActiveId] = useState(showcases[0]?.id ?? "");
  const [page, setPage] = useState(0);

  const active = showcases.find((s) => s.id === activeId) ?? showcases[0];
  if (!active) return null;

  const safePage = Math.min(page, active.pageCount - 1);
  const total = slotsPerPage(active.cols, active.rows);
  const bySlot = new Map(
    active.items.filter((it) => it.page === safePage).map((it) => [it.slot, it]),
  );

  function selectBinder(id: string) {
    setActiveId(id);
    setPage(0);
  }

  return (
    <div>
      {showcases.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {showcases.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectBinder(s.id)}
              className={`font-display -skew-x-3 rounded-[10px] px-4 py-2 text-[12px] tracking-[1.5px] uppercase transition ${
                s.id === active.id
                  ? "bg-carmin text-white"
                  : "border border-charbon-500 bg-charbon-800 text-texte-doux hover:text-blanc-casse"
              }`}
            >
              {s.title || t("binderNumber", { n: i + 1 })}
            </button>
          ))}
        </div>
      )}

      <div
        className="grid gap-3 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${active.cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, slot) => {
          const item = bySlot.get(slot);
          if (!item) {
            return (
              <div
                key={slot}
                className="aspect-5/7 rounded-xl border-2 border-dashed border-charbon-500/30 bg-charbon-800/40"
              />
            );
          }
          return (
            <Link key={slot} href={`/carte/${item.slug}`} className="block">
              <ShowcaseCard card={item} />
            </Link>
          );
        })}
      </div>

      {active.pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="font-display rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition enabled:hover:text-blanc-casse disabled:opacity-40"
          >
            {t("prevPage")}
          </button>
          <span className="text-[13px] font-bold text-texte-dim">
            {t("pageOf", { page: safePage + 1, total: active.pageCount })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(active.pageCount - 1, p + 1))}
            disabled={safePage >= active.pageCount - 1}
            className="font-display rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition enabled:hover:text-blanc-casse disabled:opacity-40"
          >
            {t("nextPage")}
          </button>
        </div>
      )}
    </div>
  );
}
