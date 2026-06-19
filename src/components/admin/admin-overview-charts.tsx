"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminChartPoint } from "@/server/admin/overview.service";

export function AdminOverviewCharts({ data }: { data: AdminChartPoint[] }) {
  const t = useTranslations("admin.overview.charts");

  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <section>
      <h2 className="font-display text-blanc-casse mb-4 text-[16px] tracking-wide uppercase">{t("title")}</h2>
      <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMembers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D6004F" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#D6004F" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8B23A" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#E8B23A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3232" />
            <XAxis dataKey="label" tick={{ fill: "#8a9494", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#8a9494", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#1E2424", border: "1px solid #3a4444", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#FBF4F6" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#8a9494" }} />
            <Area type="monotone" dataKey="members" name={t("members")} stroke="#D6004F" fill="url(#gradMembers)" strokeWidth={2} />
            <Area type="monotone" dataKey="orders" name={t("orders")} stroke="#E8B23A" fill="url(#gradOrders)" strokeWidth={2} />
            <Area type="monotone" dataKey="sales" name={t("sales")} stroke="#4ade80" fill="transparent" strokeWidth={1.5} />
            <Area type="monotone" dataKey="listings" name={t("listings")} stroke="#fb923c" fill="transparent" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
