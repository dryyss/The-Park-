import { getTranslations } from "next-intl/server";
import { getSalesPendingReview } from "@/server/review/review.service";
import { ReviewForm } from "@/components/review/review-form";

export async function PendingReviewsSection({ viewerId }: { viewerId: string }) {
  const pending = await getSalesPendingReview(viewerId);
  if (pending.length === 0) return null;

  const t = await getTranslations("reviews");

  return (
    <section className="overflow-hidden rounded-[20px] border border-[rgba(232,178,58,0.3)] bg-[rgba(232,178,58,0.06)]">
      <div className="border-b border-[rgba(232,178,58,0.2)] px-6 py-4">
        <p className="text-[11px] font-extrabold tracking-[2px] text-or uppercase">{t("pendingTitle")}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-texte-dim">{t("pendingHint")}</p>
      </div>
      <div className="flex flex-col gap-4 p-6">
        {pending.map((item) => (
          <div key={item.saleId}>
            <p className="mb-2 text-[11px] font-bold text-texte-faible">
              {t("pendingCard", { card: item.cardName })}
            </p>
            <ReviewForm
              targetId={item.targetId}
              targetName={item.targetName}
              source="SALE"
              saleId={item.saleId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
