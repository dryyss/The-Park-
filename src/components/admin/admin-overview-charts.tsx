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
      <h2 className="admin-section-title mb-4">{t("title")}</h2>
      <div className="admin-chart-panel">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#455052" />
            <XAxis dataKey="label" tick={{ fill: "#a8b4b1", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8b4b1", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#252c2e", border: "1px solid #455052", borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: "#f5f2ea", fontWeight: 600 }}
              itemStyle={{ color: "#ffffff" }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a8b4b1" }} />
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
