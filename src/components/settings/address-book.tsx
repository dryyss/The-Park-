"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { saveAddressAction, deleteAddressAction } from "@/server/user/profile.actions";
import type { UserAddress } from "@/server/user/address.service";

type AddressFormData = {
  id?: string;
  label: string;
  fullName: string;
  line1: string;
  line2: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  isDefault: boolean;
};

const EMPTY_FORM: AddressFormData = {
  label: "",
  fullName: "",
  line1: "",
  line2: "",
  zip: "",
  city: "",
  country: "FR",
  phone: "",
  isDefault: false,
};

function toForm(addr: UserAddress): AddressFormData {
  return {
    id: addr.id,
    label: addr.label ?? "",
    fullName: addr.fullName,
    line1: addr.line1,
    line2: addr.line2 ?? "",
    zip: addr.zip,
    city: addr.city,
    country: addr.country,
    phone: addr.phone ?? "",
    isDefault: addr.isDefault,
  };
}

export function AddressBook({ addresses }: { addresses: UserAddress[] }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [editing, setEditing] = useState<AddressFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setError(null);
    setEditing({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
  }

  function openEdit(addr: UserAddress) {
    setError(null);
    setEditing(toForm(addr));
  }

  function closeForm() {
    setEditing(null);
    setError(null);
  }

  function save() {
    if (!editing) return;
    setError(null);
    startTransition(async () => {
      const res = await saveAddressAction({
        id: editing.id,
        label: editing.label || undefined,
        fullName: editing.fullName,
        line1: editing.line1,
        line2: editing.line2 || undefined,
        zip: editing.zip,
        city: editing.city,
        country: editing.country,
        phone: editing.phone || undefined,
        isDefault: editing.isDefault,
      });
      if (!res.ok) {
        setError(t("addressError"));
        return;
      }
      closeForm();
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm(t("addressDeleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAddressAction(id);
      if (!res.ok) setError(t("addressError"));
      else router.refresh();
    });
  }

  function setDefault(id: string) {
    const addr = addresses.find((a) => a.id === id);
    if (!addr) return;
    setError(null);
    startTransition(async () => {
      const res = await saveAddressAction({ ...toForm(addr), isDefault: true });
      if (!res.ok) setError(t("addressError"));
      else router.refresh();
    });
  }

  const inputClass =
    "w-full rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin";

  return (
    <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("addresses")}</h2>
          <p className="mt-1.5 text-[12.5px] font-semibold text-texte-dim">{t("addressesDesc")}</p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={openNew}
            className="font-display -skew-x-3 rounded-lg border border-carmin bg-carmin/10 px-4 py-2 text-[11px] tracking-[1px] text-carmin uppercase transition hover:bg-carmin/20"
          >
            {t("addressAdd")}
          </button>
        )}
      </div>

      {addresses.length === 0 && !editing && (
        <p className="mt-4 text-[13px] font-bold text-texte-faible">{t("addressEmpty")}</p>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`rounded-xl border px-4 py-3 ${addr.isDefault ? "border-or/40 bg-or/5" : "border-charbon-500 bg-charbon-700"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-extrabold text-blanc-casse">{addr.fullName}</span>
                  {addr.isDefault && (
                    <span className="rounded bg-or/20 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-or uppercase">
                      {t("addressDefault")}
                    </span>
                  )}
                  {addr.label && <span className="text-[11px] font-bold text-texte-dim">{addr.label}</span>}
                </div>
                <p className="mt-1 text-[12px] font-semibold text-texte-dim">
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ""}
                </p>
                <p className="text-[12px] font-semibold text-texte-dim">
                  {addr.zip} {addr.city} · {addr.country}
                </p>
                {addr.phone && <p className="text-[11px] font-bold text-texte-faible">{addr.phone}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {!addr.isDefault && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setDefault(addr.id)}
                    className="rounded-md border border-charbon-500 px-2.5 py-1 text-[10px] font-extrabold text-texte-doux hover:border-carmin disabled:opacity-50"
                  >
                    {t("addressSetDefault")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openEdit(addr)}
                  className="rounded-md border border-charbon-500 px-2.5 py-1 text-[10px] font-extrabold text-carmin hover:border-carmin disabled:opacity-50"
                >
                  {t("addressEdit")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(addr.id)}
                  className="rounded-md border border-charbon-500 px-2.5 py-1 text-[10px] font-extrabold text-neon-rouge hover:border-neon-rouge disabled:opacity-50"
                >
                  {t("addressDelete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="mt-4 rounded-xl border border-charbon-500 bg-charbon p-4">
          <h3 className="text-[13px] font-extrabold text-blanc-casse">
            {editing.id ? t("addressEditTitle") : t("addressAddTitle")}
          </h3>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressLabel")}</span>
              <input className={inputClass} value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder={t("addressLabelPlaceholder")} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressFullName")}</span>
              <input className={inputClass} value={editing.fullName} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressLine1")}</span>
              <input className={inputClass} value={editing.line1} onChange={(e) => setEditing({ ...editing, line1: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressLine2")}</span>
              <input className={inputClass} value={editing.line2} onChange={(e) => setEditing({ ...editing, line2: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressZip")}</span>
              <input className={inputClass} value={editing.zip} onChange={(e) => setEditing({ ...editing, zip: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressCity")}</span>
              <input className={inputClass} value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressCountry")}</span>
              <input className={inputClass} maxLength={2} value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value.toUpperCase() })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-extrabold tracking-[1.5px] text-texte-faible uppercase">{t("addressPhone")}</span>
              <input className={inputClass} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </label>
            <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={editing.isDefault}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                className="accent-carmin"
              />
              <span className="text-[12px] font-bold text-texte-dim">{t("addressDefaultCheck")}</span>
            </label>
          </div>
          {error && <p className="mt-2 text-[12px] font-bold text-neon-rouge">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending || !editing.fullName || !editing.line1 || !editing.zip || !editing.city}
              onClick={save}
              className="font-display rounded-lg bg-carmin px-4 py-2 text-[11px] tracking-wide text-white uppercase hover:bg-carmin-alt disabled:opacity-50"
            >
              {t("addressSave")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={closeForm}
              className="font-display rounded-lg border border-charbon-500 px-4 py-2 text-[11px] tracking-wide text-texte-doux uppercase hover:border-charbon-400"
            >
              {t("addressCancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
