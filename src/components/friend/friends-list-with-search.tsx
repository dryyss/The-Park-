"use client";

import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import type { FriendEntry } from "@/server/friend/friend.service";

function ScoreDot({ pct }: { pct: number }) {
  const color = pct >= 75 ? "#5ED99A" : pct >= 40 ? "#E8B23A" : "#D81B60";
  return (
    <span
      className="ml-auto shrink-0 text-[10px] font-extrabold tabular-nums"
      style={{ color }}
    >
      {pct}%
    </span>
  );
}

export function FriendsListWithSearch({
  friends,
  title,
  searchPlaceholder,
  noResult = "Aucun rival trouvé.",
}: {
  friends: FriendEntry[];
  title: string;
  searchPlaceholder: string;
  noResult?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<"score" | "name">("score");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = query.trim().toLowerCase();
  const suggestions = q
    ? friends.filter((f) => f.displayName.toLowerCase().includes(q)).slice(0, 6)
    : [];

  const sorted = [...friends].sort((a, b) =>
    sort === "score" ? b.pct - a.pct : a.displayName.localeCompare(b.displayName)
  );

  const filtered = q ? sorted.filter((f) => f.displayName.toLowerCase().includes(q)) : sorted;

  if (friends.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[14px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
          {title}
        </h2>

        {/* Sort toggle */}
        <div className="flex gap-1 rounded-[8px] border border-charbon-500 bg-charbon-800 p-0.5">
          <button
            type="button"
            onClick={() => setSort("score")}
            className={`rounded-[6px] px-2.5 py-1 text-[10px] font-extrabold transition ${sort === "score" ? "bg-carmin text-white" : "text-texte-faible hover:text-blanc-casse"}`}
          >
            Score
          </button>
          <button
            type="button"
            onClick={() => setSort("name")}
            className={`rounded-[6px] px-2.5 py-1 text-[10px] font-extrabold transition ${sort === "name" ? "bg-carmin text-white" : "text-texte-faible hover:text-blanc-casse"}`}
          >
            A–Z
          </button>
        </div>

        {/* Search with dropdown */}
        <div className="relative min-w-[180px] flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={searchPlaceholder}
            className="w-full rounded-[10px] border border-charbon-500 bg-charbon-800 px-3 py-1.5 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setOpen(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-texte-faible hover:text-blanc-casse"
            >
              ✕
            </button>
          )}

          {/* Suggestions dropdown */}
          {open && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-[10px] border border-charbon-500 bg-charbon-900 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            >
              {suggestions.map((f) => (
                <Link
                  key={f.id}
                  href={`/collectionneur/${f.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 transition hover:bg-charbon-800"
                >
                  <div
                    className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[11px] text-white"
                    style={{ background: avatarGradient(f.displayName[0] ?? "A") }}
                  >
                    {f.displayName[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 truncate text-[12px] font-bold text-blanc-casse">{f.displayName}</span>
                  <ScoreDot pct={f.pct} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-[12.5px] font-bold text-texte-dim">{noResult}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((f) => (
            <li key={f.id}>
              <Link
                href={`/collectionneur/${f.slug}`}
                className="flex items-center gap-2 rounded-[12px] border border-charbon-500 bg-charbon-800 px-3 py-2.5 transition hover:border-charbon-400"
              >
                <div
                  className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[13px] text-white"
                  style={{ background: avatarGradient(f.displayName[0] ?? "A") }}
                >
                  {f.displayName[0]?.toUpperCase()}
                </div>
                <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-blanc-casse">{f.displayName}</span>
                <ScoreDot pct={f.pct} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
