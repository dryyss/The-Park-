"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { CommunityPhotoView } from "@/server/collection/collection-photos.service";

export function CardCommunityPhotos({ photos }: { photos: CommunityPhotoView[] }) {
  const t = useTranslations("card");
  const tc = useTranslations("conditions");
  const [active, setActive] = useState(0);

  if (photos.length === 0) return null;

  const current = photos[active] ?? photos[0];

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("communityPhotosTitle")}</h2>
        <span className="text-[10px] font-bold text-texte-faible">{photos.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-charbon-500 bg-charbon-800">
        <div className="relative aspect-[5/7] w-full">
          <Image
            key={current.id}
            src={current.url}
            alt={t("communityPhotoAlt", { name: current.collectorName })}
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover"
          />
        </div>
        <div className="border-t border-charbon-500 px-3 py-2.5">
          <Link href={`/collectionneur/${current.collectorSlug}`} className="text-[12px] font-extrabold text-blanc-casse hover:text-carmin">
            {current.collectorName}
          </Link>
          <div className="mt-0.5 text-[10.5px] font-bold text-texte-dim">
            {current.variantLabel} · {tc(current.condition)}
          </div>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(i)}
              className={[
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition",
                i === active ? "border-carmin ring-1 ring-carmin/40" : "border-charbon-500 opacity-75 hover:opacity-100",
              ].join(" ")}
            >
              <Image src={p.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
