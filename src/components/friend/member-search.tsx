"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import { FriendButton } from "./friend-button";
import type { MemberSearchResult } from "@/server/friend/friend.service";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** Recherche de membres pour ajouter des rivaux (page Rivaux). */
export function MemberSearch() {
  const t = useTranslations("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("SEARCH_FAILED");
        setResults((await res.json()) as MemberSearchResult[]);
        setSearched(true);
      } catch {
        // requête annulée ou erreur réseau : on n'affiche rien de plus
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <section>
      <h2 className="font-display mb-3 text-[14px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
        {t("findTitle")}
      </h2>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[14px] text-texte-faible">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("findPlaceholder")}
          className="w-full rounded-[14px] border border-charbon-500 bg-charbon-800 py-3 pr-4 pl-10 text-[13.5px] font-bold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-carmin"
        />
      </div>

      {searching && (
        <p className="mt-3 text-[12px] font-bold text-texte-faible">…</p>
      )}

      {!searching && searched && results.length === 0 && (
        <p className="mt-3 text-[12.5px] font-bold text-texte-dim">{t("findNoResult")}</p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r) => (
            <li
              key={r.userId}
              className="flex items-center gap-3 rounded-[14px] border border-charbon-500 bg-charbon-800 px-4 py-3"
            >
              <Link href={`/collectionneur/${r.slug}`}>
                <div
                  className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[16px] text-white"
                  style={{ background: avatarGradient(r.displayName[0] ?? "A") }}
                >
                  {r.displayName[0]?.toUpperCase()}
                </div>
              </Link>
              <Link href={`/collectionneur/${r.slug}`} className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold text-blanc-casse">{r.displayName}</p>
              </Link>
              <FriendButton
                addresseeSlug={r.slug}
                friendshipId={r.friendshipId ?? undefined}
                initialStatus={r.status}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
