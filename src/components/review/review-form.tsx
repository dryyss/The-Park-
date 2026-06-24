"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitReviewAction } from "@/server/review/review.actions";

interface ReviewFormProps {
  targetId: string;
  targetName: string;
  source: "SALE" | "EXCHANGE";
  saleId?: string;
  exchangeId?: string;
}

export function ReviewForm({ targetId, targetName, source, saleId, exchangeId }: ReviewFormProps) {
  const t = useTranslations("reviews");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (rating === 0) return;
    startTransition(async () => {
      setError(null);
      const res = await submitReviewAction({ targetId, source, saleId, exchangeId, rating, comment });
      if (res.ok) setDone(true);
      else setError(res.error ?? "UNKNOWN");
    });
  }

  if (done) {
    return (
      <div className="rounded-[14px] border border-[rgba(94,217,154,0.3)] bg-[rgba(94,217,154,0.08)] px-5 py-4 text-center">
        <p className="text-[14px] font-extrabold text-neon-vert">{t("submitted")}</p>
      </div>
    );
  }

  const active = hover || rating;

  return (
    <div className="rounded-[14px] border border-charbon-500 bg-charbon-700/60 px-5 py-4">
      <p className="mb-3 text-[11px] font-extrabold tracking-[2px] text-texte-faible uppercase">
        {t("title")} · <span className="text-blanc-casse">{targetName}</span>
      </p>

      {/* Stars */}
      <div className="mb-3 flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={t("starLabel", { n })}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className={`text-[24px] leading-none transition-transform hover:scale-110 ${
              n <= active ? "text-or" : "text-charbon-500"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t("commentPlaceholder")}
        maxLength={500}
        rows={2}
        className="w-full resize-none rounded-[10px] border border-charbon-500 bg-charbon-800 px-3 py-2 text-[13px] font-semibold text-blanc-casse placeholder:text-texte-faible focus:border-carmin/60 focus:outline-none"
      />

      {error && (
        <p className="mt-1.5 text-[11px] font-bold text-neon-rouge">
          {error === "ALREADY_REVIEWED" ? t("alreadyReviewed") : t("errorGeneric")}
        </p>
      )}

      <button
        type="button"
        disabled={rating === 0 || pending}
        onClick={submit}
        className="mt-3 rounded-[11px] bg-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-white uppercase disabled:opacity-40"
      >
        {pending ? "…" : t("submit")}
      </button>
    </div>
  );
}
