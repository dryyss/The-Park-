import { getTranslations } from "next-intl/server";
import { SecurityContextBanner, SecurityStepList } from "@/components/security/security-sections";
import { SecurityActionsPanel } from "@/components/security/security-actions-panel";
import type { SecurityExchangeContext } from "@/server/c2c/security.service";

type SecurityPageKey = "garantie" | "option-envoi" | "envoi" | "deballage" | "echange" | "etats" | "litige";

export async function SecurityPageLayout({
  pageKey,
  context,
}: {
  pageKey: SecurityPageKey;
  context: SecurityExchangeContext | null;
}) {
  const t = await getTranslations("security");

  return (
    <div className="flex flex-col gap-6">
      <SecurityStepList currentStep={pageKey} />
      <SecurityContextBanner exchange={context} />
      <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-6">
        <h2 className="font-display text-[20px] tracking-wide text-blanc-casse uppercase">{t(`pages.${pageKey}.title`)}</h2>
        <p className="mt-4 text-[14px] font-semibold leading-relaxed text-texte-dim">{t(`pages.${pageKey}.desc`)}</p>
        <ul className="mt-5 flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-3 rounded-lg bg-charbon-700 px-4 py-3 text-[13px] font-bold text-blanc-casse">
              <span className="font-display text-carmin">{String(i).padStart(2, "0")}</span>
              {t(`pages.${pageKey}.step${i}`)}
            </li>
          ))}
        </ul>
        {context ? (
          <SecurityActionsPanel pageKey={pageKey} context={context} />
        ) : (
          <p className="mt-6 text-[13px] font-bold text-texte-dim">{t("noExchange")}</p>
        )}
      </div>
    </div>
  );
}
