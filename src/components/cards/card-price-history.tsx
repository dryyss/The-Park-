"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice, formatPercent } from "@/lib/format";
import type { CardPriceHistory as CardPriceHistoryData } from "@/server/catalog/price-history.service";

function Stat({ label, value, accent }: { label: string; value: string; accent?: "up" | "down" }) {
  const color = accent === "up" ? "text-statut-succes" : accent === "down" ? "text-carmin" : "text-blanc-casse";
  return (
    <div className="rounded-xl border border-charbon-600 bg-charbon-800/60 px-3.5 py-2.5">
      <div className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{label}</div>
      <div className={`mt-1 text-[15px] font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

export function CardPriceHistory({ history }: { history: CardPriceHistoryData }) {
  const t = useTranslations("priceHistory");

  const hasData = history.count > 0;
  const trend =
    history.lastVsQuote == null ? undefined : history.lastVsQuote >= 0 ? "up" : "down";

  const chartData = history.points.map((p) => ({
    label: p.date.slice(5), // MM-JJ
    price: p.price,
  }));

  return (
    <section className="rounded-2xl border border-charbon-600 bg-charbon-900/50 p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] tracking-[1px] text-blanc-casse uppercase">{t("title")}</h2>
        <span className="text-[11px] font-bold text-texte-dim">
          {hasData ? t("basedOn", { count: history.count }) : t("indicativeOnly")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat
          label={t("last")}
          value={history.last != null ? formatPrice(history.last) : "—"}
          accent={trend}
        />
        <Stat label={t("average")} value={history.avg != null ? formatPrice(history.avg) : "—"} />
        <Stat
          label={t("range")}
          value={history.min != null ? `${formatPrice(history.min)} – ${formatPrice(history.max)}` : "—"}
        />
        <Stat label={t("quote")} value={formatPrice(history.quoteValue)} />
      </div>

      {history.lastVsQuote != null && (
        <p className="mt-2.5 text-[12px] font-bold text-texte-muet">
          {t("vsQuote", {
            sign: history.lastVsQuote >= 0 ? "+" : "−",
            pct: formatPercent(Math.abs(history.lastVsQuote)),
          })}
        </p>
      )}

      {hasData ? (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D6004F" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#D6004F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#455052" />
              <XAxis dataKey="label" tick={{ fill: "#a8b4b1", fontSize: 11 }} minTickGap={24} />
              <YAxis
                tick={{ fill: "#a8b4b1", fontSize: 11 }}
                width={44}
                tickFormatter={(v) => `${v}€`}
              />
              <Tooltip
                contentStyle={{ background: "#252c2e", border: "1px solid #455052", borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: "#f5f2ea", fontWeight: 600 }}
                itemStyle={{ color: "#ffffff" }}
                formatter={(value) => [formatPrice(Number(value)), t("tooltipPrice")]}
              />
              {history.quoteValue > 0 && (
                <ReferenceLine
                  y={history.quoteValue}
                  stroke="#E8B23A"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: t("quoteShort"), fill: "#E8B23A", fontSize: 10, position: "insideTopRight" }}
                />
              )}
              <Area type="monotone" dataKey="price" stroke="#D6004F" fill="url(#gradPrice)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-charbon-500 px-4 py-6 text-center text-[13px] text-texte-muet">
          {t("empty")}
        </p>
      )}
    </section>
  );
}
