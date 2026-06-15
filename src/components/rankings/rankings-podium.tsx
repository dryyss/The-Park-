import { avatarGradient } from "@/lib/avatars";
import type { RankingRow } from "@/server/community/community.service";

const MEDALS = ["🥇", "🥈", "🥉"];
const BORDERS = ["rgba(232,178,58,0.55)", "rgba(201,198,190,0.45)", "rgba(216,27,96,0.45)"];

export function RankingsPodium({ rows }: { rows: RankingRow[] }) {
  const layout = [rows[1], rows[0], rows[2]].filter(Boolean);
  const pads = ["pt-8 pb-5", "pt-4 pb-6", "pt-8 pb-5"];

  return (
    <div className="mt-8 grid grid-cols-3 items-end gap-3.5">
      {layout.map((p, i) => {
        if (!p) return <div key={i} />;
        const medalIdx = p.rank - 1;
        return (
          <div
            key={p.slug}
            className={`relative rounded-[18px] border-[1.5px] bg-charbon-800 text-center ${pads[i]}`}
            style={{ borderColor: BORDERS[medalIdx] ?? BORDERS[0] }}
          >
            <div className="font-display absolute -top-3 left-1/2 -translate-x-1/2 -rotate-3 rounded-md bg-charbon-700 px-3.5 py-1 text-[13px]">
              {MEDALS[medalIdx]}
            </div>
            <div
              className="font-display mx-auto mt-2.5 flex h-14 w-14 -rotate-3 items-center justify-center rounded-[20px] text-[22px] text-white shadow-[4px_4px_0_rgba(0,0,0,0.45)]"
              style={{ background: avatarGradient(p.initial) }}
            >
              {p.initial}
            </div>
            <div className="font-display mt-3.5 text-[17px] tracking-[1px] text-blanc-casse">{p.displayName}</div>
            <div className="font-display mt-1 text-[30px]" style={{ color: medalIdx === 0 ? "#E8B23A" : "#F2EFE9" }}>
              {p.value}
            </div>
            <div className="mt-0.5 text-[11px] font-bold tracking-[1px] text-texte-dim uppercase">{p.subLabel}</div>
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
