import { avatarGradient } from "@/lib/avatars";
import type { RankingRow } from "@/server/community/community.service";

const MEDALS = ["🥇", "🥈", "🥉"];
const BORDERS = ["rgba(232,178,58,0.55)", "rgba(201,198,190,0.45)", "rgba(216,27,96,0.45)"];

export function RankingsPodium({ rows }: { rows: RankingRow[] }) {
  const layout = [rows[1], rows[0], rows[2]].filter(Boolean);
  const pads = ["pt-8 pb-5", "pt-5 pb-7", "pt-8 pb-5"];

  return (
    <div className="mt-10 grid grid-cols-3 items-end gap-3.5">
      {layout.map((p, i) => {
        if (!p) return <div key={i} />;
        const medalIdx = p.rank - 1;
        const isWinner = medalIdx === 0;
        return (
          <div
            key={p.slug}
            className={[
              "relative rounded-[18px] text-center transition",
              pads[i],
              isWinner
                ? "z-10 -translate-y-3 scale-[1.06] border-2 bg-gradient-to-b from-[#2b2410] to-charbon-800 shadow-[0_0_46px_rgba(232,178,58,0.38)]"
                : "border-[1.5px] bg-charbon-800",
            ].join(" ")}
            style={{ borderColor: isWinner ? "#E8B23A" : BORDERS[medalIdx] ?? BORDERS[0] }}
          >
            {isWinner && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[26px] drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]">
                👑
              </div>
            )}
            <div
              className={[
                "font-display absolute left-1/2 -translate-x-1/2 -rotate-3 rounded-md",
                isWinner
                  ? "-top-3.5 bg-or px-3 py-1 text-[14px] text-charbon shadow-[0_4px_12px_rgba(232,178,58,0.5)]"
                  : "-top-3 bg-charbon-700 px-3.5 py-1 text-[13px]",
              ].join(" ")}
            >
              {MEDALS[medalIdx]}
            </div>
            <div
              className={[
                "font-display mx-auto -rotate-3 items-center justify-center text-white shadow-[4px_4px_0_rgba(0,0,0,0.45)] flex",
                isWinner
                  ? "mt-5 h-20 w-20 rounded-[24px] text-[30px] ring-2 ring-or/70 ring-offset-2 ring-offset-charbon-800"
                  : "mt-2.5 h-14 w-14 rounded-[20px] text-[22px]",
              ].join(" ")}
              style={{ background: avatarGradient(p.initial) }}
            >
              {p.initial}
            </div>
            <div
              className={[
                "font-display tracking-[1px] text-blanc-casse",
                isWinner ? "mt-4 text-[21px]" : "mt-3.5 text-[17px]",
              ].join(" ")}
            >
              {p.displayName}
            </div>
            <div
              className="font-display mt-1"
              style={
                isWinner
                  ? { color: "#E8B23A", fontSize: "44px", lineHeight: 1, textShadow: "0 2px 16px rgba(232,178,58,0.45)" }
                  : { color: "#F2EFE9", fontSize: "30px" }
              }
            >
              {p.value}
            </div>
            <div
              className={[
                "mt-0.5 font-bold tracking-[1px] uppercase",
                isWinner ? "text-[11.5px] text-or" : "text-[11px] text-texte-dim",
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
    <div className="mt-5 overflow-hidden rounded-[18px] border border-charbon-500 bg-charbon-800">
      {rows.map((r) => (
        <div
          key={r.slug}
          className={[
            "flex items-center gap-4 border-b border-charbon-600 px-5.5 py-3 last:border-0",
            r.isViewer ? "bg-carmin/8" : "",
          ].join(" ")}
          style={{ borderLeft: `3px solid ${RANK_COLORS[Math.min(r.rank - 1, 3)]}` }}
        >
          <span className="font-display w-[34px] text-[16px]" style={{ color: RANK_COLORS[Math.min(r.rank - 1, 3)] }}>
            #{r.rank}
          </span>
          <span
            className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] text-white"
            style={{ background: avatarGradient(r.initial) }}
          >
            {r.initial}
          </span>
          <span className="w-[190px] text-[13.5px] font-extrabold text-blanc-casse">
            {r.displayName}
            {r.isViewer && <span className="ml-1 text-[10.5px] font-bold text-carmin">(toi)</span>}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-charbon-600">
            <div className="h-full rounded bg-linear-to-r from-carmin to-carmin-neon transition-all" style={{ width: `${r.barPct}%` }} />
          </div>
          <span className="font-display w-[92px] text-right text-[17px] text-blanc-casse">{r.value}</span>
          <span className="w-[84px] text-[10.5px] font-bold tracking-[0.5px] text-texte-dim uppercase">{r.subLabel}</span>
        </div>
      ))}
    </div>
  );
}
