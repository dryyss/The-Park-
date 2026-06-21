import { getTranslations } from "next-intl/server";
import type { AdminImageUploadMode } from "@/lib/admin-image-upload.types";

export async function AdminStorageBanner({ uploadMode }: { uploadMode: AdminImageUploadMode }) {
  if (uploadMode !== "disabled") return null;

  const t = await getTranslations("admin.upload");

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-or/40 bg-or/10 px-5 py-4 text-[13px] leading-relaxed text-blanc-casse"
    >
      <p className="font-extrabold text-or">{t("storageBannerTitle")}</p>
      <p className="mt-2 text-texte-corps">{t("storageBannerBody")}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[12.5px] text-texte-doux">
        <li>{t("storageBannerStep1")}</li>
        <li>{t("storageBannerStep2")}</li>
        <li>{t("storageBannerStep3")}</li>
      </ol>
      <p className="mt-3 text-[11.5px] text-texte-faible">{t("storageBannerFallback")}</p>
    </div>
  );
}
