import { avatarGradient } from "@/lib/avatars";
import { UserHoverCard } from "@/components/profile/user-hover-card";
import type { RankingRow } from "@/server/community/community.service";

const MEDALS = ["🥇", "🥈", "🥉"];
const BORDERS = ["rgba(232,178,58,0.55)", "rgba(201,198,190,0.45)", "rgba(216,27,96,0.45)"];

export function RankingsPodium({ rows }: { rows: RankingRow[] }) {
  const layout = [rows[1], rows[0], rows[2]].filter(Boolean);
  const pads = ["pt-8 pb-5", "pt-5 pb-7", "pt-8 pb-5"];

  return (
    <div className="mt-8 grid min-w-0 grid-cols-3 items-end gap-2 sm:mt-10 sm:gap-3.5">
      {layout.map((p, i) => {
        if (!p) return <div key={i} />;
        const medalIdx = p.rank - 1;
        const isWinner = medalIdx === 0;
        return (
          <div
            key={p.slug}
            className={[
              "relative min-w-0 rounded-[14px] text-center transition sm:rounded-[18px]",
              pads[i],
              isWinner
                ? "z-10 -translate-y-1 scale-[1.02] border-2 bg-gradient-to-b from-[#2b2410] to-charbon-800 shadow-[0_0_46px_rgba(232,178,58,0.38)] sm:-translate-y-3 sm:scale-[1.06]"
                : "border-[1.5px] bg-charbon-800",
            ].join(" ")}
            style={{ borderColor: isWinner ? "#E8B23A" : BORDERS[medalIdx] ?? BORDERS[0] }}
          >
            {isWinner && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[20px] drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)] sm:-top-7 sm:text-[26px]">
                👑
              </div>
            )}
            <div
              className={[
                "font-display absolute left-1/2 -translate-x-1/2 -rotate-3 rounded-md",
                isWinner
                  ? "-top-3 bg-or px-2 py-0.5 text-[12px] text-charbon shadow-[0_4px_12px_rgba(232,178,58,0.5)] sm:-top-3.5 sm:px-3 sm:py-1 sm:text-[14px]"
                  : "-top-2.5 bg-charbon-700 px-2.5 py-0.5 text-[11px] sm:-top-3 sm:px-3.5 sm:py-1 sm:text-[13px]",
              ].join(" ")}
            >
              {MEDALS[medalIdx]}
            </div>
            <div
              className={[
                "font-display mx-auto -rotate-3 items-center justify-center text-white shadow-[4px_4px_0_rgba(0,0,0,0.45)] flex",
                isWinner
                  ? "mt-4 h-14 w-14 rounded-[18px] text-[22px] ring-2 ring-or/70 ring-offset-2 ring-offset-charbon-800 sm:mt-5 sm:h-20 sm:w-20 sm:rounded-[24px] sm:text-[30px]"
                  : "mt-2 h-11 w-11 rounded-[16px] text-[16px] sm:mt-2.5 sm:h-14 sm:w-14 sm:rounded-[20px] sm:text-[22px]",
              ].join(" ")}
              style={{ background: avatarGradient(p.initial) }}
            >
              {p.initial}
            </div>
            <div
              className={[
                "font-display truncate tracking-[0.5px] text-blanc-casse sm:tracking-[1px]",
                isWinner ? "mt-3 text-[14px] sm:mt-4 sm:text-[21px]" : "mt-2.5 text-[12px] sm:mt-3.5 sm:text-[17px]",
              ].join(" ")}
            >
              {p.slug ? <UserHoverCard slug={p.slug}>{p.displayName}</UserHoverCard> : p.displayName}
            </div>
            <div
              className={[
                "font-display mt-1 leading-none",
                isWinner ? "text-[28px] text-or sm:text-[44px]" : "text-[20px] text-blanc-casse sm:text-[30px]",
              ].join(" ")}
              style={isWinner ? { textShadow: "0 2px 16px rgba(232,178,58,0.45)" } : undefined}
            >
              {p.value}
            </div>
            <div
              className={[
                "mt-0.5 truncate font-bold tracking-[0.5px] uppercase sm:tracking-[1px]",
                isWinner ? "text-[9px] text-or sm:text-[11.5px]" : "text-[9px] text-texte-dim sm:text-[11px]",
              ].join(" ")}
            >
              {p.subLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RankingsTable({ rows }: { rows: RankingRow[] }) {
  const RANK_COLORS = ["#E8B23A", "#C9C6BE", "#E8945A", "#6E6E78"];

  return (
    <div className="mt-5 overflow-x-auto scroll-touch rounded-[18px] border border-charbon-500 bg-charbon-800">
      {rows.map((r) => (
        <div
          key={r.slug}
          className={[
            "flex min-w-[min(100%,520px)] items-center gap-2 border-b border-charbon-600 px-3 py-3 last:border-0 sm:min-w-[640px] sm:gap-4 sm:px-5.5",
            r.isViewer ? "bg-carmin/8" : "",
          ].join(" ")}
          style={{ borderLeft: `3px solid ${RANK_COLORS[Math.min(r.rank - 1, 3)]}` }}
        >
          <span className="font-display w-7 shrink-0 text-[14px] sm:w-[34px] sm:text-[16px]" style={{ color: RANK_COLORS[Math.min(r.rank - 1, 3)] }}>
            #{r.rank}
          </span>
          <span
            className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] text-white sm:h-8 sm:w-8 sm:text-[12px]"
            style={{ background: avatarGradient(r.initial) }}
          >
            {r.initial}
          </span>
          <span className="min-w-[100px] flex-1 truncate text-[12.5px] font-extrabold text-blanc-casse sm:w-[190px] sm:flex-none sm:text-[13.5px]">
            {r.slug ? <UserHoverCard slug={r.slug}>{r.displayName}</UserHoverCard> : r.displayName}
            {r.isViewer && <span className="ml-1 text-[10px] font-bold text-carmin sm:text-[10.5px]">(toi)</span>}
          </span>
          <div className="hidden h-1.5 min-w-[80px] flex-1 overflow-hidden rounded bg-charbon-600 sm:block">
            <div className="h-full rounded bg-linear-to-r from-carmin to-carmin-neon transition-all" style={{ width: `${r.barPct}%` }} />
          </div>
          <span className="font-display w-[52px] shrink-0 text-right text-[14px] text-blanc-casse sm:w-[92px] sm:text-[17px]">{r.value}</span>
          <span className="hidden w-[84px] shrink-0 text-[10.5px] font-bold tracking-[0.5px] text-texte-dim uppercase sm:inline">{r.subLabel}</span>
        </div>
      ))}
    </div>
  );
}
