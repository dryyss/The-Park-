"use client";

import { useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { extendGuaranteeAction } from "@/server/c2c/state-machine.actions";
import { exchangeStatusStyle, EXCHANGE_STATUS_I18N } from "@/lib/exchange-status";
import type { ExchangeStateMachineView } from "@/server/c2c/state-machine.service";

function Deadline({ label, date }: { label: string; date: Date | null }) {
  const format = useFormatter();
  if (!date) return null;
  const overdue = date.getTime() < Date.now();
  return (
    <div className="rounded-xl border border-charbon-600 bg-charbon-800/50 px-3.5 py-2.5">
      <div className="text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">{label}</div>
      <div className={`mt-1 text-[13px] font-extrabold ${overdue ? "text-neon-rouge" : "text-blanc-casse"}`}>
        {format.dateTime(date, { dateStyle: "medium", timeStyle: "short" })}
      </div>
    </div>
  );
}

export function ExchangeStateMachine({ view }: { view: ExchangeStateMachineView }) {
  const t = useTranslations("security.states");
  const tExchange = useTranslations("exchanges");
  const tStatus = (key: string) => tExchange(`status.${key}`);
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const style = exchangeStatusStyle(view.status);

  function extend() {
    startTransition(async () => {
      await extendGuaranteeAction(view.exchangeId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[2px] text-texte-dim uppercase">
            {view.shortId} · {view.partnerName}
          </p>
          <span
            className="mt-1.5 inline-block rounded-md px-2.5 py-1 text-[12px] font-extrabold uppercase"
            style={{ background: style.bg, color: style.color }}
          >
            {tStatus(EXCHANGE_STATUS_I18N[view.status])}
          </span>
        </div>
        {view.secured && (
          <span className="rounded-md bg-or/15 px-2.5 py-1 text-[11px] font-extrabold text-or uppercase">
            {t("secured")}
          </span>
        )}
      </div>

      {/* Chemin nominal */}
      <ol className="flex flex-wrap gap-2">
        {view.steps.map((step) => (
          <li
            key={step.key}
            className={[
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-bold transition",
              step.current
                ? "border-carmin bg-carmin/10 text-blanc-casse"
                : step.reached
                  ? "border-statut-succes/40 bg-statut-succes/5 text-statut-succes"
                  : "border-charbon-600 text-texte-dim",
            ].join(" ")}
          >
            <span className="text-[10px]">{step.reached ? "●" : "○"}</span>
            {tStatus(EXCHANGE_STATUS_I18N[step.key])}
          </li>
        ))}
      </ol>

      {view.interrupted && (
        <p className="rounded-xl border border-neon-rouge/30 bg-neon-rouge/5 px-4 py-3 text-[12px] font-bold text-neon-rouge">
          {t("interrupted", { status: tStatus(EXCHANGE_STATUS_I18N[view.status]) })}
        </p>
      )}

      {/* Échéances */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Deadline label={t("shipBy")} date={view.deadlines.shipBy} />
        <Deadline label={t("guaranteeUntil")} date={view.deadlines.guaranteeUntil} />
        {view.secured && <Deadline label={t("reauthBy")} date={view.deadlines.reauthBy} />}
      </div>

      {/* Prolongation garantie */}
      {view.guarantee.canExtend && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charbon-600 bg-charbon-800/50 px-4 py-3">
          <p className="text-[12px] font-bold text-texte-muet">
            {t("extendHint", { used: view.guarantee.extendedCount, max: view.guarantee.maxExtensions })}
          </p>
          <button
            type="button"
            onClick={extend}
            disabled={pending}
            className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white transition hover:bg-carmin-alt disabled:opacity-50"
          >
            {pending ? t("extending") : t("extend")}
          </button>
        </div>
      )}

      {/* Timeline horodatée */}
      {view.timeline.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("timeline")}</p>
          <ul className="flex flex-col gap-1.5">
            {view.timeline.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-charbon-600 bg-charbon-800/40 px-3.5 py-2">
                <span className="text-[12px] font-bold text-blanc-casse">
                  {e.event}
                  {e.bySystem && <span className="ml-2 text-[10px] font-extrabold text-texte-dim uppercase">{t("system")}</span>}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-texte-dim">
                  {format.dateTime(e.at, { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
