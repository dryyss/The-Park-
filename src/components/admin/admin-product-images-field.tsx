"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cardImage } from "@/lib/rarity";

const inputCls =
  "min-w-0 flex-1 rounded-md border border-charbon-500 bg-charbon-700/80 px-2 py-1.5 text-[12px] text-blanc-casse outline-none focus:border-or/60";

export function normalizeProductImages(images: string[]): string[] {
  return images.map((url) => url.trim()).filter(Boolean);
}

export function productImagesEqual(a: string[], b: string[]): boolean {
  const left = normalizeProductImages(a);
  const right = normalizeProductImages(b);
  if (left.length !== right.length) return false;
  return left.every((url, index) => url === right[index]);
}

function ImagePreview({ url }: { url: string }) {
  const t = useTranslations("admin.shop");
  const [failed, setFailed] = useState(false);
  const trimmed = url.trim();
  const src = trimmed ? cardImage(trimmed) : null;

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-charbon-500 bg-charbon-900">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu admin temps réel
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-bold text-texte-faible">
          {!trimmed ? t("imagePreviewEmpty") : t("imagePreviewError")}
        </div>
      )}
    </div>
  );
}

export function AdminProductImagesField({
  images,
  onChange,
  max = 12,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const t = useTranslations("admin.shop");

  function updateAt(index: number, value: string) {
    const next = [...images];
    next[index] = value;
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function add() {
    if (images.length >= max) return;
    onChange([...images, ""]);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("images")}</p>
          <p className="mt-0.5 text-[11px] text-texte-faible">{t("imagesHint")}</p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={images.length >= max}
          className="rounded-md border border-or/40 px-2.5 py-1 text-[10px] font-extrabold text-or uppercase hover:bg-or/10 disabled:opacity-40"
        >
          + {t("addImage")}
        </button>
      </div>

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-charbon-500 px-3 py-4 text-center text-[12px] font-bold text-texte-dim">
          {t("noImages")}
        </p>
      ) : (
        <ul className="space-y-2">
          {images.map((url, index) => (
            <li key={index} className="flex items-center gap-2 rounded-md border border-charbon-500/80 bg-charbon-700/40 p-2">
              <ImagePreview url={url} />
              <input
                value={url}
                onChange={(e) => updateAt(index, e.target.value)}
                placeholder={t("imagePlaceholder")}
                aria-label={t("imageUrl", { index: index + 1 })}
                className={inputCls}
              />
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("moveImageUp")}
                  className="rounded border border-charbon-500 px-1.5 py-0.5 text-[10px] text-texte-dim hover:text-blanc-casse disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label={t("moveImageDown")}
                  className="rounded border border-charbon-500 px-1.5 py-0.5 text-[10px] text-texte-dim hover:text-blanc-casse disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={t("removeImage")}
                className="shrink-0 rounded-md border border-neon-rouge/40 px-2 py-1 text-[10px] font-extrabold text-neon-rouge uppercase hover:bg-neon-rouge/10"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function releaseDatesEqual(a: string | null, localValue: string): boolean {
  const parsed = fromDatetimeLocalValue(localValue);
  if (!a && !parsed) return true;
  if (!a || !parsed) return false;
  return new Date(a).getTime() === new Date(parsed).getTime();
}
