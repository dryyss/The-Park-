"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

type Tab = { k: string; label: string; href: string };

/**
 * Onglets du classement rendus côté client : le changement d'onglet est instantané
 * (transition React) avec un indicateur « en cours » — évite l'impression de « rien
 * ne se passe » sur connexion lente qui poussait à re-cliquer plusieurs fois.
 */
export function RankingsTabs({ tabs, current }: { tabs: Tab[]; current: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  return (
    <div className="mb-1 flex gap-1 rounded-xl border border-charbon-500 bg-charbon-800 p-1.5">
      {tabs.map((tab) => {
        const active = current === tab.k;
        const loading = isPending && pendingKey === tab.k;
        return (
          <button
            key={tab.k}
            type="button"
            disabled={active || isPending}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (active) return;
              setPendingKey(tab.k);
              startTransition(() => router.push(tab.href));
            }}
            className={[
              "font-display flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[12.5px] tracking-[1.5px] uppercase transition",
              active
                ? "bg-carmin text-white"
                : "text-texte-muet hover:text-blanc-casse disabled:opacity-70",
            ].join(" ")}
          >
            {tab.label}
            {loading && (
              <span
                aria-hidden
                className="inline-block h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
