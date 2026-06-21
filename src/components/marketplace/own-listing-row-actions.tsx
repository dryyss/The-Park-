"use client";

import { useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cancelListingAction } from "@/server/marketplace/marketplace.actions";

export function OwnListingRowActions({ listingId }: { listingId: string }) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      await cancelListingAction({ listingId });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href="/dashboard"
        className="font-display -skew-x-3 rounded-lg border-[1.5px] border-or bg-or/10 px-4 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap text-or uppercase transition hover:bg-or/20"
      >
        {t("actionManage")}
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={handleCancel}
        className="font-display -skew-x-3 rounded-lg border-[1.5px] border-neon-rouge/60 px-4 py-2.5 text-[11px] tracking-[1px] whitespace-nowrap text-neon-rouge uppercase transition hover:bg-neon-rouge/10 disabled:opacity-50"
      >
        {pending ? "…" : t("actionCancelListing")}
      </button>
    </div>
  );
}
