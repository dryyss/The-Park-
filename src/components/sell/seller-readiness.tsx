"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";
import { Link } from "@/i18n/navigation";
import type { SellerReadiness, SellerStep } from "@/server/marketplace/seller-readiness.service";
import { setBirthDateAction, addAddressAction } from "@/server/marketplace/seller-readiness.actions";

function ageFromInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function SellerReadiness({
  readiness,
  isAuthenticated = true,
}: {
  readiness: SellerReadiness;
  isAuthenticated?: boolean;
}) {
  const t = useTranslations("sellReady");
  const router = useRouter();
  const doneCount = readiness.steps.filter((s) => s.required && s.done).length;
  const requiredCount = readiness.steps.filter((s) => s.required).length;

  return (
    <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px] tracking-wide -skew-x-3 uppercase text-blanc-casse">{t("title")}</h2>
          <p className="mt-1.5 text-[13px] font-semibold text-texte-dim">{t("intro")}</p>
        </div>
        <span className="font-display shrink-0 rounded-full border border-charbon-500 px-3 py-1 text-[12px] font-bold text-texte-doux">
          {doneCount}/{requiredCount}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {readiness.steps.map((step) => (
          <StepRow key={step.key} step={step} readiness={readiness} isAuthenticated={isAuthenticated} onDone={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

function StepRow({
  step,
  readiness,
  isAuthenticated,
  onDone,
}: {
  step: SellerStep;
  readiness: SellerReadiness;
  isAuthenticated: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("sellReady");
  const [open, setOpen] = useState(false);

  const tone = step.done
    ? { border: "border-statut-succes/40", bg: "bg-statut-succes/8" }
    : step.required
      ? { border: "border-charbon-500", bg: "bg-charbon" }
      : { border: "border-charbon-500", bg: "bg-charbon" };

  return (
    <div className={`rounded-[14px] border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start gap-3.5">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
            step.done ? "bg-statut-succes/20 text-statut-succes" : "border border-charbon-400 text-texte-faible"
          }`}
        >
          {step.done ? "✓" : "•"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-blanc-casse">{t(`${step.key}.title`)}</h3>
            {!step.required && (
              <span className="rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-texte-faible uppercase ring-1 ring-charbon-500">
                {t("optional")}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-texte-dim">
            {step.state === "pending-consent" ? t("age.pendingConsent") : t(`${step.key}.desc`)}
          </p>

          {/* Action par étape */}
          {!step.done && (
            <div className="mt-3">
              {step.key === "age" && (
                <AgeForm initialBirthDate={readiness.birthDate} isAuthenticated={isAuthenticated} onDone={onDone} />
              )}
              {step.key === "address" && (
                <>
                  {open ? (
                    <AddressForm isAuthenticated={isAuthenticated} onDone={onDone} onCancel={() => setOpen(false)} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) {
                          setOpen(true);
                          return;
                        }
                        setOpen(true);
                      }}
                      className="font-display rounded-[9px] bg-carmin px-4 py-2 text-[12px] tracking-wide text-white uppercase transition hover:bg-carmin-alt"
                    >
                      {t("address.cta")}
                    </button>
                  )}
                  {!isAuthenticated && open && (
                    <div className="mt-2">
                      <LoginGatePrompt compact messageKey="loginGateSell" />
                    </div>
                  )}
                </>
              )}
              {step.key === "account" && !isAuthenticated && (
                <LoginGatePrompt compact messageKey="loginGateSell" />
              )}
              {step.key === "account" && isAuthenticated && (
                <p className="text-[12px] font-bold text-texte-faible">{t("account.hint")}</p>
              )}
              {step.key === "payout" && (
                <p className="text-[12px] font-bold text-texte-faible">
                  {t("payout.hint")}{" "}
                  <Link href="/portefeuille" className="text-carmin underline">
                    {t("payout.link")}
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgeForm({
  initialBirthDate,
  isAuthenticated,
  onDone,
}: {
  initialBirthDate: string | null;
  isAuthenticated: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("sellReady");
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? "");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const age = ageFromInput(birthDate);
  const isMinor = age !== null && age < 18;

  function submit() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setBirthDateAction({
        birthDate,
        guardianEmail: isMinor ? guardianEmail : undefined,
      });
      if (res.ok) onDone();
      else setError(t("error"));
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateSell" />}
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("age.label")}</span>
          <input
            type="date"
            value={birthDate}
            max="2025-12-31"
            onChange={(e) => setBirthDate(e.target.value)}
            className="rounded-[9px] border-[1.5px] border-charbon-500 bg-charbon px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
        </label>
        {isMinor && (
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("age.guardian")}</span>
            <input
              type="email"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              placeholder="tuteur@email.fr"
              className="rounded-[9px] border-[1.5px] border-charbon-500 bg-charbon px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
            />
          </label>
        )}
        <button
          type="button"
          disabled={isPending || !birthDate || (isMinor && !guardianEmail)}
          onClick={submit}
          className="font-display rounded-[9px] bg-carmin px-4 py-2 text-[12px] tracking-wide text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {t("save")}
        </button>
      </div>
      {isMinor && <p className="text-[11px] font-bold text-or">{t("age.minorNotice")}</p>}
      {error && <p className="text-[11px] font-bold text-statut-danger">{error}</p>}
    </div>
  );
}

function AddressForm({
  isAuthenticated,
  onDone,
  onCancel,
}: {
  isAuthenticated: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("sellReady");
  const [form, setForm] = useState({ fullName: "", line1: "", line2: "", zip: "", city: "", country: "FR", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addAddressAction(form);
      if (res.ok) onDone();
      else setError(t("error"));
    });
  }

  const input = "rounded-[9px] border-[1.5px] border-charbon-500 bg-charbon px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin";

  return (
    <div className="flex flex-col gap-2.5">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateSell" />}
      <input className={input} placeholder={t("address.fullName")} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
      <input className={input} placeholder={t("address.line1")} value={form.line1} onChange={(e) => set("line1", e.target.value)} />
      <input className={input} placeholder={t("address.line2")} value={form.line2} onChange={(e) => set("line2", e.target.value)} />
      <div className="flex gap-2.5">
        <input className={`${input} w-[110px]`} placeholder={t("address.zip")} value={form.zip} onChange={(e) => set("zip", e.target.value)} />
        <input className={`${input} flex-1`} placeholder={t("address.city")} value={form.city} onChange={(e) => set("city", e.target.value)} />
        <input className={`${input} w-[70px] uppercase`} maxLength={2} placeholder="FR" value={form.country} onChange={(e) => set("country", e.target.value)} />
      </div>
      <input className={input} placeholder={t("address.phone")} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      {error && <p className="text-[11px] font-bold text-statut-danger">{error}</p>}
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={isPending || !form.fullName || !form.line1 || !form.zip || !form.city}
          onClick={submit}
          className="font-display rounded-[9px] bg-carmin px-4 py-2 text-[12px] tracking-wide text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {t("save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-display rounded-[9px] border border-charbon-500 px-4 py-2 text-[12px] tracking-wide text-texte-doux uppercase transition hover:border-charbon-400"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
