"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import Image from "next/image";
import type { AdminPhotoRow } from "@/server/admin/content-admin.service";
import { adminDeletePhotoAction } from "@/server/admin/admin.actions";

export function AdminContentPanel({
  rows,
  total,
  page,
  pageSize,
  stats,
  query,
}: {
  rows: AdminPhotoRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { totalPhotos: number; uniqueItems: number; recentWeek: number };
  query: string;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyFilters(nextPage = 1) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (nextPage > 1) sp.set("page", String(nextPage));
    router.push(`/admin/contenu${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  function remove(photoId: string) {
    if (!confirm(t("confirmDelete"))) return;
    setError(null);
    startTransition(async () => {
      const res = await adminDeletePhotoAction(photoId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { key: "totalPhotos", value: stats.totalPhotos },
          { key: "uniqueItems", value: stats.uniqueItems },
          { key: "recentWeek", value: stats.recentWeek },
        ].map((s) => (
          <div key={s.key} className="rounded-[12px] border border-charbon-500 bg-charbon-800 p-4">
            <p className="text-texte-dim text-[10px] font-extrabold uppercase">{t(`stats.${s.key}`)}</p>
            <p className="font-display text-blanc-casse mt-1 text-[24px]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} placeholder={t("searchPlaceholder")} className="flex-1 rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse" />
        <button type="button" onClick={() => applyFilters()} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase">{t("filter")}</button>
      </div>

      {error && <p className="text-[13px] font-bold text-neon-rouge">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-[14px] border border-charbon-500 bg-charbon-800">
            <div className="relative aspect-[3/4] bg-charbon-900">
              <Image src={photo.url} alt="" fill className="object-cover" sizes="(max-width:768px) 50vw, 33vw" />
            </div>
            <div className="p-4">
              <p className="font-extrabold text-blanc-casse">#{photo.cardNumber} {photo.cardName}</p>
              <p className="text-texte-dim mt-1 text-[12px]">
                <Link href={`/admin/utilisateurs/${photo.collectorId}`} className="text-carmin hover:underline">{photo.collectorName}</Link>
                {" · "}{photo.condition}
              </p>
              {photo.reportCount > 0 && (
                <p className="text-neon-orange mt-1 text-[11px] font-extrabold uppercase">{t("reported", { count: photo.reportCount })}</p>
              )}
              <button type="button" disabled={pending} onClick={() => remove(photo.id)} className="mt-3 rounded-md border border-neon-rouge/50 px-3 py-1.5 text-[10px] font-extrabold text-neon-rouge uppercase disabled:opacity-50">
                {t("delete")}
              </button>
            </div>
          </article>
        ))}
      </div>

      {rows.length === 0 && <p className="text-center text-[13px] font-bold text-texte-dim">{t("empty")}</p>}

      <div className="flex items-center justify-between text-[12px] font-bold text-texte-dim">
        <span>{t("total", { count: total })}</span>
        <div className="flex gap-3">
          <button type="button" disabled={page <= 1} onClick={() => applyFilters(page - 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("prev")}</button>
          <span>{t("pageOf", { page, total: totalPages })}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => applyFilters(page + 1)} className="rounded-lg border border-charbon-500 px-3 py-1.5 uppercase disabled:opacity-40">{t("next")}</button>
        </div>
      </div>
    </div>
  );
}
