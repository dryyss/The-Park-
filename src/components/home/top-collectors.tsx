import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatPercent } from "@/lib/format";
import type { TopCollector } from "@/server/community/community.service";

const AVATARS = [
  "linear-gradient(135deg,#D81B60,#7A0F37)",
  "linear-gradient(135deg,#6FE3D0,#1F8C7A)",
  "linear-gradient(135deg,#4FA3FF,#1F4E8C)",
  "linear-gradient(135deg,#B05CFF,#5A1F8C)",
  "linear-gradient(135deg,#FF6B5E,#8C2F1F)",
];
const RANK_COLORS = ["#E8B23A", "#C9C6BE", "#E8945A", "#6E6E78", "#6E6E78"];

export async function TopCollectors({ collectors }: { collectors: TopCollector[] }) {
  const t = await getTranslations("home");

  if (collectors.length === 0) return null;

  return (
    <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 px-[26px] py-6">
      <h2 className="font-display mb-[18px] text-[22px] tracking-[1.5px] skew-x-[-3deg] uppercase text-blanc-casse">
        {t("topCollectorsTitle")}
      </h2>
      <div className="flex flex-col gap-1">
        {collectors.map((c, i) => {
          const pct = formatPercent(c.ratio);
          return (
            <Link
              key={c.slug || c.rank}
              href={`/collectionneur/${c.slug}`}
              className="flex items-center gap-3 rounded-[11px] px-2 py-[9px] transition hover:bg-charbon-700"
            >
              <span className="font-display w-[22px] shrink-0 text-center text-base" style={{ color: RANK_COLORS[i] ?? "#6E6E78" }}>
                {c.rank}
              </span>
              <span
                className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] text-white"
                style={{ background: AVATARS[i] ?? AVATARS[0] }}
              >
                {c.initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-extrabold text-blanc-casse">{c.displayName}</div>
                <div className="text-[10.5px] font-bold text-texte-muet">
                  {c.owned}/{c.total} cartes · {pct}
                </div>
              </div>
              <div className="h-[5px] w-[54px] shrink-0 overflow-hidden rounded-[3px] bg-charbon-600">
                <div className="h-full rounded-[3px] bg-linear-to-r from-carmin to-carmin-neon" style={{ width: pct }} />
              </div>
            </Link>
          );
        })}
      </div>
      <Link
        href="/classements"
        className="font-display mt-3.5 block rounded-[10px] border-[1.5px] border-charbon-400 py-[11px] text-center text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:border-carmin hover:text-white"
      >
        {t("seeFullRanking")}
      </Link>
    </div>
  );
}
