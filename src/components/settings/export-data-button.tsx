"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { exportUserDataAction } from "@/server/user/account.actions";

export function ExportDataButton() {
  const t = useTranslations("settings");
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const res = await exportUserDataAction();
      if (!res.ok) return;
      const blob = new Blob([res.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `the-park-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={download}
      className="mt-4 rounded-lg border border-carmin bg-carmin/10 px-4 py-2 text-[12px] font-extrabold text-carmin uppercase transition hover:bg-carmin/20 disabled:opacity-50"
    >
      {pending ? t("exportPending") : t("exportData")}
    </button>
  );
}
