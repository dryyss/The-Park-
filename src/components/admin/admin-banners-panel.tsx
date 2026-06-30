"use client";

import { useState, useTransition } from "react";
import type { PromoBanner } from "@/generated/prisma/client";

type BannerForm = {
  label: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  color: string;
  position: "bottom-left" | "bottom-right";
  active: boolean;
  sortOrder: number;
  startAt: string;
  endAt: string;
};

const EMPTY_FORM: BannerForm = {
  label: "",
  title: "",
  subtitle: "",
  cta: "Découvrir →",
  href: "/",
  color: "#d81b60",
  position: "bottom-left",
  active: true,
  sortOrder: 0,
  startAt: "",
  endAt: "",
};

function toForm(b: PromoBanner): BannerForm {
  return {
    label: b.label ?? "",
    title: b.title,
    subtitle: b.subtitle ?? "",
    cta: b.cta ?? "",
    href: b.href,
    color: b.color,
    position: (b.position as "bottom-left" | "bottom-right") ?? "bottom-left",
    active: b.active,
    sortOrder: b.sortOrder,
    startAt: b.startAt ? b.startAt.toISOString?.()?.slice(0, 16) ?? "" : "",
    endAt: b.endAt ? b.endAt.toISOString?.()?.slice(0, 16) ?? "" : "",
  };
}

function BannerFormFields({ form, setForm }: { form: BannerForm; setForm: (f: BannerForm) => void }) {
  const field = (key: keyof BannerForm) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: key === "sortOrder" ? Number(e.target.value) : e.target.value }),
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label-admin">Label (chip)</label>
        <input {...field("label")} placeholder="NOUVEAUTÉ" className="input-admin" />
      </div>
      <div>
        <label className="label-admin">Titre *</label>
        <input {...field("title")} placeholder="Pack Nuit Tokyo" className="input-admin" required />
      </div>
      <div className="sm:col-span-2">
        <label className="label-admin">Sous-titre</label>
        <input {...field("subtitle")} placeholder="Disponible dès maintenant" className="input-admin" />
      </div>
      <div>
        <label className="label-admin">CTA</label>
        <input {...field("cta")} placeholder="Découvrir →" className="input-admin" />
      </div>
      <div>
        <label className="label-admin">Lien *</label>
        <input {...field("href")} placeholder="/catalogue" className="input-admin" required />
      </div>
      <div>
        <label className="label-admin">Couleur accent</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="h-[38px] w-[44px] cursor-pointer rounded-lg border border-charbon-500 bg-charbon p-0.5"
          />
          <input {...field("color")} className="input-admin flex-1" />
        </div>
      </div>
      <div>
        <label className="label-admin">Position</label>
        <select {...field("position")} className="input-admin">
          <option value="bottom-left">Bas gauche</option>
          <option value="bottom-right">Bas droite</option>
        </select>
      </div>
      <div>
        <label className="label-admin">Ordre (tri croissant)</label>
        <input type="number" {...field("sortOrder")} className="input-admin" />
      </div>
      <div>
        <label className="label-admin">Début (optionnel)</label>
        <input type="datetime-local" {...field("startAt")} className="input-admin" />
      </div>
      <div>
        <label className="label-admin">Fin (optionnel)</label>
        <input type="datetime-local" {...field("endAt")} className="input-admin" />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id="active-toggle"
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
          className="h-4 w-4 accent-carmin"
        />
        <label htmlFor="active-toggle" className="text-[13px] font-bold text-blanc-casse">Active</label>
      </div>
    </div>
  );
}

export function AdminBannersPanel({ banners: initialBanners }: { banners: PromoBanner[] }) {
  const [banners, setBanners] = useState<PromoBanner[]>(initialBanners);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowCreate(true);
    setError(null);
  }

  function openEdit(b: PromoBanner) {
    setForm(toForm(b));
    setEditId(b.id);
    setShowCreate(true);
    setError(null);
  }

  function handleSave() {
    if (!form.title.trim() || !form.href.trim()) {
      setError("Le titre et le lien sont obligatoires.");
      return;
    }
    setError(null);

    const body = {
      label: form.label || null,
      title: form.title,
      subtitle: form.subtitle || null,
      cta: form.cta || null,
      href: form.href,
      color: form.color,
      position: form.position,
      active: form.active,
      sortOrder: form.sortOrder,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
    };

    startTransition(async () => {
      const url = editId ? `/api/admin/banners/${editId}` : "/api/admin/banners";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setError("Erreur lors de la sauvegarde."); return; }
      const saved: PromoBanner = await res.json();
      setBanners((prev) => editId ? prev.map((b) => b.id === editId ? saved : b) : [saved, ...prev]);
      setShowCreate(false);
      setEditId(null);
    });
  }

  function handleToggle(id: string, active: boolean) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/banners/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
      if (!res.ok) return;
      const saved: PromoBanner = await res.json();
      setBanners((prev) => prev.map((b) => b.id === id ? saved : b));
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette bannière ?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setBanners((prev) => prev.filter((b) => b.id !== id));
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[13px] text-texte-faible">{banners.length} bannière{banners.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          onClick={openCreate}
          className="font-display -skew-x-3 rounded-lg bg-carmin px-5 py-2.5 text-[13px] tracking-[1.5px] text-white uppercase hover:opacity-85"
        >
          + Nouvelle bannière
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-[16px] border border-charbon-500 bg-charbon-800 p-6">
          <h3 className="mb-4 font-display text-[16px] tracking-[1.5px] text-blanc-casse uppercase">
            {editId ? "Modifier la bannière" : "Nouvelle bannière"}
          </h3>
          <BannerFormFields form={form} setForm={setForm} />
          {error && <p className="mt-3 text-[12px] font-bold text-statut-danger">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="font-display -skew-x-3 rounded-lg bg-carmin px-5 py-2.5 text-[13px] tracking-[1.5px] text-white uppercase hover:opacity-85 disabled:opacity-50"
            >
              {pending ? "Sauvegarde…" : "Sauvegarder"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setEditId(null); }}
              className="rounded-lg border border-charbon-500 px-5 py-2.5 text-[13px] font-bold text-texte-faible hover:text-blanc-casse"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {banners.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-charbon-500 py-16 text-center text-texte-faible">
          Aucune bannière — crée-en une ci-dessus.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {banners.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-4 rounded-[14px] border bg-charbon-800 px-5 py-4 transition ${b.active ? "border-charbon-500" : "border-charbon-700 opacity-60"}`}
            >
              <div
                className="h-9 w-[5px] shrink-0 rounded-full"
                style={{ background: b.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {b.label && (
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-[1.5px] uppercase" style={{ background: `${b.color}22`, color: b.color }}>
                      {b.label}
                    </span>
                  )}
                  <span className="font-bold text-blanc-casse">{b.title}</span>
                  <span className="text-[11px] text-texte-faible">{b.position}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-texte-faible">
                  {b.href}
                  {b.startAt && ` · Début ${new Date(b.startAt).toLocaleDateString("fr")}`}
                  {b.endAt && ` · Fin ${new Date(b.endAt).toLocaleDateString("fr")}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(b.id, !b.active)}
                  disabled={pending}
                  className={`rounded-full px-3 py-1 text-[10px] font-extrabold transition ${b.active ? "bg-statut-succes/15 text-statut-succes" : "bg-charbon-700 text-texte-faible"}`}
                >
                  {b.active ? "Active" : "Inactive"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(b)}
                  className="text-[11px] font-bold text-texte-faible hover:text-blanc-casse"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  disabled={pending}
                  className="text-[11px] font-bold text-statut-danger hover:opacity-75"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        .label-admin { display: block; margin-bottom: 4px; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: var(--color-texte-dim); }
        .input-admin { width: 100%; border-radius: 8px; border: 1px solid var(--color-charbon-500); background: var(--color-charbon); padding: 8px 12px; font-size: 13px; font-weight: 700; color: var(--color-blanc-casse); outline: none; }
        .input-admin:focus { border-color: var(--color-carmin); }
      `}</style>
    </div>
  );
}
