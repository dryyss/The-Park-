"use client";

import Image from "next/image";
import { useRef, useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { CollectionItemPhotoView, CollectionPhotoKind } from "@/server/collection/collection-photos.types";
import { MAX_GRADED_PHOTOS_PER_KIND, MAX_PHOTOS_PER_ITEM } from "@/lib/collection-photos.constants";

export function CollectionPhotoManager({
  variantId,
  condition,
  photos: initialPhotos,
  kind = "CARD",
  maxPhotos,
  labelKey,
  hintKey,
}: {
  variantId: string;
  condition: string;
  photos: CollectionItemPhotoView[];
  kind?: CollectionPhotoKind;
  maxPhotos?: number;
  labelKey?: "photosLabel" | "gradedCardPhotoLabel" | "gradedCertPhotoLabel";
  hintKey?: "photosHint" | "gradedCardPhotoHint" | "gradedCertPhotoHint";
}) {
  const t = useTranslations("card");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initialPhotos);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const limit = maxPhotos ?? (kind === "CERTIFICATE" ? MAX_GRADED_PHOTOS_PER_KIND : MAX_PHOTOS_PER_ITEM);

  function mapError(code: string) {
    if (code === "MAX_PHOTOS") return t("photoErrorMax", { max: limit });
    if (code === "FILE_TOO_LARGE") return t("photoErrorSize");
    if (code === "INVALID_TYPE") return t("photoErrorType");
    if (code === "NOT_GRADED") return t("gradingError");
    return t("photoError");
  }

  function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("variantId", variantId);
    fd.set("condition", condition);
    fd.set("kind", kind);
    fd.set("file", file);

    startTransition(async () => {
      const res = await fetch("/api/collection/photos", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: boolean; error?: string; photo?: CollectionItemPhotoView };
      if (!res.ok || !data.ok || !data.photo) {
        setError(mapError(data.error ?? "UNKNOWN"));
        return;
      }
      setPhotos((prev) => [...prev, data.photo!]);
      router.refresh();
    });
  }

  function remove(photoId: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/collection/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(mapError(data.error ?? "UNKNOWN"));
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      router.refresh();
    });
  }

  const label = t(labelKey ?? "photosLabel");
  const hint = hintKey ? t(hintKey) : t("photosHint");

  return (
    <div className="mt-2 rounded-lg border border-dashed border-charbon-500 bg-charbon/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[9.5px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{label}</span>
        <span className="text-[10px] font-bold text-texte-faible">
          {t("photosCount", { count: photos.length, max: limit })}
        </span>
      </div>
      <p className="mt-1 text-[10px] font-bold text-texte-faible">{hint}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-charbon-500">
            <Image src={p.url} alt="" fill sizes="64px" className="object-cover" />
            <button
              type="button"
              disabled={pending}
              aria-label={t("photoRemove")}
              onClick={() => remove(p.id)}
              className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] font-extrabold text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-40"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < limit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-charbon-500 bg-charbon-700 text-[20px] text-texte-dim transition hover:border-carmin hover:text-carmin disabled:opacity-50"
            >
              +
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-[10px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
