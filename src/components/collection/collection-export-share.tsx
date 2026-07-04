"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

/** Boutons d'export (CSV/JSON) et de partage du lien public de la collection. */
export function CollectionExportShare({ slug }: { slug: string | null }) {
  const t = useTranslations("collection");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!slug) return;
    const url = `${window.location.origin}/${locale}/collectionneur/${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t("shareTitle"), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* partage annulé — no-op */
    }
  }

  const btn =
    "rounded-lg border border-charbon-500 px-3 py-1.5 text-[11px] font-extrabold text-texte-dim transition hover:border-carmin hover:text-carmin";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a href="/api/collection/export?format=csv" download className={btn}>
        {t("exportCsv")}
      </a>
      <a href="/api/collection/export?format=json" download className={btn}>
        {t("exportJson")}
      </a>
      {slug && (
        <button type="button" onClick={share} className={btn}>
          {copied ? t("shareCopied") : t("share")}
        </button>
      )}
    </div>
  );
}
