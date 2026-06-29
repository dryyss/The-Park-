"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import type { FriendEntry } from "@/server/friend/friend.service";

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

  const filtered = query.trim()
    ? friends.filter((f) => f.displayName.toLowerCase().includes(query.toLowerCase()))
    : friends;

  if (friends.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[14px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
          {title}
        </h2>
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-[10px] border border-charbon-500 bg-charbon-800 px-3 py-1.5 text-[12px] font-semibold text-blanc-casse placeholder:text-texte-faible outline-none focus:border-carmin/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-texte-faible hover:text-blanc-casse text-[12px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[12.5px] font-bold text-texte-dim py-4 text-center">
          {noResult}
        </p>
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
                <span className="truncate text-[12px] font-extrabold text-blanc-casse">{f.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
