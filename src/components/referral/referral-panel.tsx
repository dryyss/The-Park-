"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { applyReferralCodeAction } from "@/server/referral/referral.actions";
import type { ReferralOverview } from "@/server/referral/referral.service";

function referralError(code: string, t: (k: string) => string): string {
  switch (code) {
    case "INVALID_CODE":
      return t("errorInvalid");
    case "SELF":
      return t("errorSelf");
    case "ALREADY_REFERRED":
      return t("errorAlready");
    default:
      return t("errorGeneric");
  }
}

export function ReferralPanel({
  overview,
  prefillCode,
}: {
  overview: ReferralOverview;
  prefillCode?: string;
}) {
  const t = useTranslations("referral");
  const locale = useLocale();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState(prefillCode ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/parrainage?ref=${overview.code}`
      : `/${locale}/parrainage?ref=${overview.code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no-op */
    }
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await applyReferralCodeAction({ code });
      if (res.ok) {
        setApplied(true);
        router.refresh();
      } else {
        setError(referralError(res.error, t));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mon code + lien */}
      <section className="rounded-2xl border border-or/30 bg-or/5 p-5">
        <p className="text-[11px] font-extrabold tracking-[2px] text-or uppercase">{t("yourCode")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-display rounded-lg bg-charbon-800 px-4 py-2 text-[22px] tracking-[3px] text-blanc-casse">
            {overview.code}
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-carmin px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-carmin-alt"
          >
            {copied ? t("copied") : t("copyLink")}
          </button>
        </div>
        <p className="mt-3 text-[12px] font-bold text-texte-muet">{t("explain", { amount: `${overview.bonusEur} €` })}</p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-charbon-600 bg-charbon-800/60 px-4 py-3 text-center">
          <div className="text-[20px] font-extrabold text-blanc-casse">{overview.rewardedCount}</div>
          <div className="text-[10px] font-bold tracking-[1px] text-texte-dim uppercase">{t("rewarded")}</div>
        </div>
        <div className="rounded-xl border border-charbon-600 bg-charbon-800/60 px-4 py-3 text-center">
          <div className="text-[20px] font-extrabold text-blanc-casse">{overview.pendingCount}</div>
          <div className="text-[10px] font-bold tracking-[1px] text-texte-dim uppercase">{t("pending")}</div>
        </div>
        <div className="rounded-xl border border-charbon-600 bg-charbon-800/60 px-4 py-3 text-center">
          <div className="text-[20px] font-extrabold text-statut-succes">{overview.totalEarnedEur.toFixed(2)} €</div>
          <div className="text-[10px] font-bold tracking-[1px] text-texte-dim uppercase">{t("earned")}</div>
        </div>
      </section>

      {/* Saisir un code parrain */}
      {!overview.alreadyReferred && !applied && (
        <section className="rounded-2xl border border-charbon-600 bg-charbon-900/50 p-5">
          <p className="text-[11px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("haveCode")}</p>
          <form onSubmit={apply} className="mt-3 flex flex-wrap gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("codePlaceholder")}
              maxLength={16}
              className="min-w-0 flex-1 rounded-lg border border-charbon-500 bg-charbon px-3 py-2.5 text-[13px] font-bold tracking-[2px] text-blanc-casse uppercase outline-none focus:border-carmin"
            />
            <button
              type="submit"
              disabled={pending || code.length < 3}
              className="rounded-lg bg-carmin px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-carmin-alt disabled:opacity-50"
            >
              {pending ? t("applying") : t("apply")}
            </button>
          </form>
          {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
        </section>
      )}
      {(overview.alreadyReferred || applied) && (
        <p className="rounded-xl border border-statut-succes/30 bg-statut-succes/5 px-4 py-3 text-[12px] font-bold text-statut-succes">
          {t("alreadyReferredNote")}
        </p>
      )}

      {/* Liste des filleuls */}
      {overview.referrals.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("yourReferrals")}</p>
          <ul className="flex flex-col gap-1.5">
            {overview.referrals.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-charbon-600 bg-charbon-800/40 px-3.5 py-2.5"
              >
                <span className="text-[13px] font-bold text-blanc-casse">{r.name}</span>
                <span
                  className={[
                    "rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase",
                    r.status === "REWARDED" ? "bg-statut-succes/15 text-statut-succes" : "bg-charbon-600 text-texte-dim",
                  ].join(" ")}
                >
                  {r.status === "REWARDED" ? t("statusRewarded") : t("statusPending")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
