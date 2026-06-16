"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cancelListingAction, pauseListingAction, resumeListingAction } from "@/server/marketplace/marketplace.actions";

export function ListingActions({ listingId, status }: { listingId: string; status: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: "pause" | "resume" | "cancel") {
    startTransition(async () => {
      const fn =
        action === "pause" ? pauseListingAction : action === "resume" ? resumeListingAction : cancelListingAction;
      await fn({ listingId });
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {status === "ACTIVE" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("pause")}
          className="text-[10px] font-extrabold text-texte-dim hover:text-carmin disabled:opacity-50"
        >
          {t("pauseListing")}
        </button>
      )}
      {status === "PAUSED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("resume")}
          className="text-[10px] font-extrabold text-neon-vert hover:underline disabled:opacity-50"
        >
          {t("resumeListing")}
        </button>
      )}
      {(status === "ACTIVE" || status === "PAUSED") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("cancel")}
          className="text-[10px] font-extrabold text-neon-rouge hover:underline disabled:opacity-50"
        >
          {t("cancelListing")}
        </button>
      )}
    </div>
  );
}
