"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";

type Tab = { k: string; label: string; href: string };

/**
 * Onglets du classement. Ce sont de vrais liens : cliquables avant hydratation et
 * pendant une navigation déjà en cours. Aucun `disabled` pendant le chargement —
 * il avalait les clics émis dans cet intervalle, d'où le « ça ne marche pas
 * toujours ». Le retour visuel est la surbrillance optimiste de l'onglet cliqué.
 */
export function RankingsTabs({ tabs }: { tabs: Tab[] }) {
  // Rendus dans le layout du segment, les onglets survivent au rechargement de
  // la page : ils lisent donc la catégorie active directement dans l'URL.
  const searchParams = useSearchParams();
  const cat = searchParams.get("cat");
  const current = tabs.some((t) => t.k === cat) ? (cat as string) : tabs[0].k;
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    setPendingKey(null);
  }, [current]);

  return (
    <div className="mb-1 flex gap-1 overflow-x-auto rounded-xl border border-charbon-500 bg-charbon-800 p-1.5">
      {tabs.map((tab) => {
        const active = pendingKey === null ? current === tab.k : pendingKey === tab.k;
        const loading = pendingKey === tab.k && current !== tab.k;
        return (
          <Link
            key={tab.k}
            href={tab.href}
            onClick={() => setPendingKey(tab.k)}
            aria-current={active ? "page" : undefined}
            className={[
              "font-display flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] tracking-[1.5px] whitespace-nowrap uppercase transition-colors",
              active ? "bg-carmin text-white" : "text-texte-muet hover:text-blanc-casse",
            ].join(" ")}
          >
            {tab.label}
            {loading && (
              <span
                aria-hidden
                className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
