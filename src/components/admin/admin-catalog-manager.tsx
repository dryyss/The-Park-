"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cardImage } from "@/lib/rarity";
import type {
  AdminCatalogSeason,
  AdminCardFull,
  AdminRarityOption,
  AdminVersionTypeOption,
} from "@/server/admin/admin.mutations";
import { updateSeasonAction } from "@/server/admin/shop.actions";
import {
  createCardAction,
  updateCardAction,
  deleteCardAction,
  createCardVariantAction,
  updateCardVariantAction,
  deleteCardVariantAction,
} from "@/server/admin/catalog.actions";
import { AdminImageDropzone } from "@/components/admin/admin-image-dropzone";
import type { AdminImageUploadMode } from "@/lib/admin-image-upload.types";
import { AdminFilterBar, AdminFilterSelect, matchAdminSearch } from "@/components/admin/admin-filter-bar";
import { isHorsSerieSeasonCode } from "@/lib/seasons";

const LANGUAGES = ["FR", "EN", "JP", "DE", "US"] as const;

const num = (fd: FormData, k: string): number | undefined => {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return undefined;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};
const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string): string | null => str(fd, k) || null;

export function AdminCatalogManager({
  seasons,
  rarities,
  versionTypes,
  uploadMode,
}: {
  seasons: AdminCatalogSeason[];
  rarities: AdminRarityOption[];
  versionTypes: AdminVersionTypeOption[];
  uploadMode: AdminImageUploadMode;
}) {
  const t = useTranslations("admin.catalog");
  const tFilters = useTranslations("admin.filters");
  const [openSeasons, setOpenSeasons] = useState<Set<string>>(() => new Set(seasons.map((s) => s.id)));
  const [q, setQ] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");

  const filteredSeasons = useMemo(() => {
    const hasCardFilter = Boolean(q.trim() || rarityFilter);
    return seasons
      .filter((s) => !seasonFilter || s.id === seasonFilter)
      .map((s) => ({
        ...s,
        cards: s.cards.filter((c) => {
          if (rarityFilter && c.rarityId !== rarityFilter) return false;
          return matchAdminSearch(q, c.name, c.number, c.country, c.slug);
        }),
      }))
      .filter((s) => !hasCardFilter || s.cards.length > 0);
  }, [seasons, q, seasonFilter, rarityFilter]);

  const resultCount = useMemo(
    () => filteredSeasons.reduce((sum, s) => sum + s.cards.length, 0),
    [filteredSeasons],
  );

  const hasFilters = Boolean(q.trim() || seasonFilter || rarityFilter);
  const visibleOpenSeasons = hasFilters ? new Set(filteredSeasons.map((s) => s.id)) : openSeasons;

  function toggleSeason(id: string) {
    setOpenSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    setQ("");
    setSeasonFilter("");
    setRarityFilter("");
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminFilterBar
        live
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("searchPlaceholder")}
        onReset={hasFilters ? resetFilters : undefined}
      >
        <AdminFilterSelect
          label={t("filterSeason")}
          value={seasonFilter}
          onChange={setSeasonFilter}
          options={[
            { value: "", label: t("seasonAll") },
            ...seasons.map((s) => ({
              value: s.id,
              label: isHorsSerieSeasonCode(s.code) ? t("horsSerieLabel") : `${s.code} · ${s.name}`,
            })),
          ]}
        />
        <AdminFilterSelect
          label={t("filterRarity")}
          value={rarityFilter}
          onChange={setRarityFilter}
          options={[
            { value: "", label: t("rarityAll") },
            ...rarities.map((r) => ({ value: r.id, label: r.label })),
          ]}
        />
      </AdminFilterBar>

      {hasFilters && (
        <p className="text-[12px] font-bold text-texte-faible">{tFilters("resultsCount", { count: resultCount })}</p>
      )}

      {filteredSeasons.length === 0 ? (
        <p className="rounded-[14px] border border-charbon-500 bg-charbon-800 px-4 py-8 text-center text-[13px] font-bold text-texte-dim">
          {tFilters("noResults")}
        </p>
      ) : (
        filteredSeasons.map((s) => (
        <section
          key={s.id}
          className={`rounded-[16px] border p-5 ${
            isHorsSerieSeasonCode(s.code)
              ? "border-or/45 bg-gradient-to-br from-or/8 to-charbon-800"
              : "border-charbon-500 bg-charbon-800"
          }`}
        >
          <SeasonHeader season={s} open={visibleOpenSeasons.has(s.id)} onToggle={() => toggleSeason(s.id)} />
          {visibleOpenSeasons.has(s.id) && (
            <div className="mt-5 flex flex-col gap-4">
              <NewCardForm seasonId={s.id} seasonCode={s.code} rarities={rarities} uploadMode={uploadMode} />
              {s.cards.length === 0 ? (
                <p className="text-[12px] font-bold text-texte-faible">{t("noCards")}</p>
              ) : (
                s.cards.map((c) => (
                  <CardEditor key={c.id} card={c} seasonCode={s.code} rarities={rarities} versionTypes={versionTypes} uploadMode={uploadMode} />
                ))
              )}
            </div>
          )}
        </section>
        ))
      )}
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const t = useTranslations("admin.catalog");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void, successMsg?: string) {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await fn();
          if (res.ok) {
            if (successMsg) {
              setSuccess(successMsg);
              setTimeout(() => {
                setSuccess(null);
                onDone?.();
                router.refresh();
              }, 1200);
            } else {
              onDone?.();
              router.refresh();
            }
          } else {
            setError(errLabel(t, res.error));
          }
        } catch {
          setError(t("errUnknown"));
        }
      })();
    });
  }

  return { pending, error, success, run };
}

function errLabel(t: ReturnType<typeof useTranslations>, code?: string): string {
  switch (code) {
    case "NUMBER_REQUIRED":
      return t("errNumberRequired");
    case "NUMBER_TAKEN":
      return t("errNumberTaken");
    case "CARD_IN_USE":
      return t("errCardInUse");
    case "VARIANT_EXISTS":
      return t("errVariantExists");
    case "VARIANT_IN_USE":
      return t("errVariantInUse");
    case "LAST_VARIANT":
      return t("errLastVariant");
    case "NOT_FOUND":
      return t("errNotFound");
    case "VALIDATION":
      return t("errValidation");
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return t("errForbidden");
    default:
      return t("errUnknown");
  }
}

function SeasonHeader({
  season,
  open,
  onToggle,
}: {
  season: AdminCatalogSeason;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("admin.catalog");
  const { pending, run } = useAction();
  const horsSerie = isHorsSerieSeasonCode(season.code);

  function save(fd: FormData) {
    const releaseRaw = str(fd, "releaseDate");
    run(() =>
      updateSeasonAction({
        seasonId: season.id,
        name: str(fd, "name"),
        releaseDate: releaseRaw ? new Date(releaseRaw).toISOString() : null,
      }),
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <button
        type="button"
        onClick={onToggle}
        className="font-display flex h-9 w-9 items-center justify-center rounded-lg border border-charbon-500 text-[16px] text-or hover:border-or"
        aria-label={open ? t("collapse") : t("expand")}
      >
        {open ? "−" : "+"}
      </button>
      <div>
        <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("code")}</label>
        <p className="font-mono text-[14px] text-or">{season.code}</p>
        {horsSerie && (
          <span className="mt-1 inline-block rounded-md bg-or/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-or uppercase">
            {t("horsSerieBadge")}
          </span>
        )}
      </div>
      <form action={(fd) => save(fd)} className="flex w-full flex-1 flex-col flex-wrap items-stretch gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[160px]">
          <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("name")}</label>
          <input name="name" defaultValue={season.name} className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse" />
        </div>
        <div>
          <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("cards")}</label>
          <p className="text-[14px] font-bold text-blanc-casse">{season.cards.length}</p>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{t("release")}</label>
          <input
            name="releaseDate"
            type="datetime-local"
            defaultValue={season.releaseDate ? new Date(season.releaseDate).toISOString().slice(0, 16) : ""}
            className="mt-1 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-blanc-casse sm:w-auto"
          />
        </div>
        <button type="submit" disabled={pending} className="rounded-lg bg-carmin px-4 py-2 text-[12px] font-extrabold text-white uppercase disabled:opacity-50">
          {t("save")}
        </button>
      </form>
    </div>
  );
}

function NewCardForm({
  seasonId,
  seasonCode,
  rarities,
  uploadMode,
}: {
  seasonId: string;
  seasonCode: string;
  rarities: AdminRarityOption[];
  uploadMode: AdminImageUploadMode;
}) {
  const t = useTranslations("admin.catalog");
  const [open, setOpen] = useState(false);
  const { pending, error, success, run } = useAction();
  const horsSerie = isHorsSerieSeasonCode(seasonCode);

  function submit(fd: FormData) {
    const cardNumber = num(fd, "number");
    const cardName = str(fd, "name");

    if (cardNumber === undefined) {
      // setError via run won't work before run starts, so show directly via a fake failed run
      run(() => Promise.resolve({ ok: false as const, error: "NUMBER_REQUIRED" }));
      return;
    }
    if (!cardName) {
      run(() => Promise.resolve({ ok: false as const, error: "VALIDATION" }));
      return;
    }

    run(
      () =>
        createCardAction({
          seasonId,
          number: cardNumber,
          name: cardName,
          rarityId: str(fd, "rarityId"),
          quoteValue: num(fd, "quoteValue") ?? 0,
          imageUrl: optStr(fd, "imageUrl"),
          country: optStr(fd, "country"),
          brand: optStr(fd, "brand"),
          description: optStr(fd, "description"),
          isUnique: fd.get("isUnique") === "on",
        }),
      () => setOpen(false),
      t("createSuccess"),
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-display w-fit rounded-lg border border-dashed border-or/50 px-4 py-2 text-[12px] tracking-wide text-or uppercase hover:bg-or/10"
      >
        + {t("newCard")}
      </button>
    );
  }

  return (
    <form action={(fd) => submit(fd)} className="rounded-[14px] border border-or/30 bg-charbon-900/40 p-4">
      <h4 className="font-display text-[13px] tracking-wide text-or uppercase">{t("newCard")}</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("number")} hint={horsSerie ? t("numberHintHorsSerie") : t("numberHint")}>
          <input name="number" type="number" min={0} defaultValue="" placeholder={horsSerie ? "ex: 1" : "ex: 80"} className={inputCls} />
        </Field>
        <Field label={t("name")}><input name="name" placeholder={t("namePlaceholder")} className={inputCls} /></Field>
        <Field label={t("rarity")}>
          <select name="rarityId" className={inputCls}>
            {rarities.map((r) => (
              <option key={r.id} value={r.id} className="bg-charbon-800">{r.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t("quote")}><input name="quoteValue" type="number" step="0.01" defaultValue={0} className={inputCls} /></Field>
        <Field label={t("country")}><input name="country" maxLength={8} className={inputCls} /></Field>
        <Field label={t("brand")}><input name="brand" maxLength={60} placeholder={t("brandPlaceholder")} className={inputCls} /></Field>
        <ImageUrlField uploadMode={uploadMode} className="sm:col-span-2 lg:col-span-3" />
        <Field label={t("description")} className="sm:col-span-2 lg:col-span-3">
          <textarea name="description" rows={3} className={`${inputCls} resize-none`} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12px] font-bold text-texte-doux">
        <input type="checkbox" name="isUnique" className="accent-carmin" /> {t("isUnique")}
      </label>
      {error && <p className="mt-2 text-[12px] font-bold text-neon-rouge">{error}</p>}
      {success && <p className="mt-2 text-[12px] font-bold text-neon-vert">{success}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending || !!success} className="rounded-lg bg-or px-4 py-2 text-[11px] font-extrabold text-charbon uppercase disabled:opacity-50">{t("create")}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-charbon-500 px-4 py-2 text-[11px] font-extrabold text-texte-dim uppercase">{t("cancel")}</button>
      </div>
    </form>
  );
}

function CardEditor({
  card,
  seasonCode,
  rarities,
  versionTypes,
  uploadMode,
}: {
  card: AdminCardFull;
  seasonCode: string;
  rarities: AdminRarityOption[];
  versionTypes: AdminVersionTypeOption[];
  uploadMode: AdminImageUploadMode;
}) {
  const t = useTranslations("admin.catalog");
  const { pending, error, run } = useAction();
  const [showVariants, setShowVariants] = useState(false);
  const horsSerie = isHorsSerieSeasonCode(seasonCode);

  function save(fd: FormData) {
    run(() =>
      updateCardAction({
        cardId: card.id,
        number: num(fd, "number"),
        name: str(fd, "name"),
        rarityId: str(fd, "rarityId"),
        quoteValue: num(fd, "quoteValue"),
        imageUrl: optStr(fd, "imageUrl"),
        powerCh: num(fd, "powerCh") ?? null,
        weightKg: num(fd, "weightKg") ?? null,
        country: optStr(fd, "country"),
        brand: optStr(fd, "brand"),
        description: optStr(fd, "description"),
        isUnique: fd.get("isUnique") === "on",
      }),
    );
  }

  function remove() {
    if (!confirm(t("confirmDeleteCard", { name: card.name }))) return;
    run(() => deleteCardAction({ cardId: card.id }));
  }

  return (
    <div className="rounded-[14px] border border-charbon-500 bg-charbon-700/40 p-4">
      <form action={(fd) => save(fd)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("number")} hint={horsSerie ? t("numberHintHorsSerie") : t("numberHint")}>
          <input name="number" type="number" min={0} defaultValue={card.number} className={inputCls} />
        </Field>
        <Field label={t("name")}><input name="name" defaultValue={card.name} className={inputCls} /></Field>
        <Field label={t("rarity")}>
          <select name="rarityId" defaultValue={card.rarityId} className={inputCls}>
            {rarities.map((r) => (
              <option key={r.id} value={r.id} className="bg-charbon-800">{r.label}</option>
            ))}
          </select>
        </Field>
        <Field label={t("quote")}><input name="quoteValue" type="number" step="0.01" defaultValue={card.quoteValue} className={inputCls} /></Field>
        <Field label={t("power")}><input name="powerCh" type="number" defaultValue={card.powerCh ?? ""} className={inputCls} /></Field>
        <Field label={t("weight")}><input name="weightKg" type="number" defaultValue={card.weightKg ?? ""} className={inputCls} /></Field>
        <Field label={t("country")}><input name="country" maxLength={8} defaultValue={card.country ?? ""} className={inputCls} /></Field>
        <Field label={t("brand")}><input name="brand" maxLength={60} defaultValue={card.brand ?? ""} placeholder={t("brandPlaceholder")} className={inputCls} /></Field>
        <ImageUrlField uploadMode={uploadMode} key={`${card.id}-${card.imageUrl ?? ""}`} defaultValue={card.imageUrl ?? ""} className="sm:col-span-2 lg:col-span-4" />
        <Field label={t("description")} className="sm:col-span-2 lg:col-span-4">
          <textarea name="description" defaultValue={card.description ?? ""} rows={2} className={`${inputCls} resize-none`} />
        </Field>
        <label className="flex items-center gap-2 text-[12px] font-bold text-texte-doux">
          <input type="checkbox" name="isUnique" defaultChecked={card.isUnique} className="accent-carmin" /> {t("isUnique")}
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
          <button type="submit" disabled={pending} className="rounded-lg bg-carmin px-4 py-2 text-[11px] font-extrabold text-white uppercase disabled:opacity-50">{t("save")}</button>
          <button type="button" onClick={remove} disabled={pending} className="rounded-lg border border-neon-rouge/50 px-4 py-2 text-[11px] font-extrabold text-neon-rouge uppercase hover:bg-neon-rouge/10 disabled:opacity-50">{t("delete")}</button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => setShowVariants((v) => !v)}
        className="mt-3 text-[11px] font-extrabold tracking-wide text-or uppercase hover:underline"
      >
        {t("variants")} ({card.variants.length}) {showVariants ? "▾" : "▸"}
      </button>
      {error && <p className="mt-2 text-[12px] font-bold text-neon-rouge">{error}</p>}

      {showVariants && <CardVariants card={card} versionTypes={versionTypes} />}
    </div>
  );
}

function CardVariants({ card, versionTypes }: { card: AdminCardFull; versionTypes: AdminVersionTypeOption[] }) {
  const t = useTranslations("admin.catalog");
  const { pending, error, run } = useAction();
  const [adding, setAdding] = useState(false);

  function add(fd: FormData) {
    run(
      () =>
        createCardVariantAction({
          cardId: card.id,
          versionTypeId: str(fd, "versionTypeId"),
          language: str(fd, "language"),
          editionLabel: optStr(fd, "editionLabel"),
        }),
      () => setAdding(false),
    );
  }

  function removeVariant(v: AdminCardFull["variants"][number]) {
    const label = [v.versionTypeLabel, v.language, v.editionLabel].filter(Boolean).join(" · ");
    if (!confirm(t("confirmDeleteVariant", { label }))) return;
    run(() => deleteCardVariantAction({ variantId: v.id }));
  }

  return (
    <div className="mt-3 rounded-lg border border-charbon-500 bg-charbon-900/40 p-3">
      <div className="flex flex-col gap-2">
        {card.variants.length === 0 && <p className="text-[11px] font-bold text-texte-faible">{t("noVariants")}</p>}
        {card.variants.map((v) => (
          <form
            key={v.id}
            action={(fd) =>
              run(() =>
                updateCardVariantAction({
                  variantId: v.id,
                  versionTypeId: str(fd, "versionTypeId"),
                  language: str(fd, "language"),
                  editionLabel: optStr(fd, "editionLabel"),
                }),
              )
            }
            className="flex flex-wrap items-center gap-2 rounded-md bg-charbon-800 px-2 py-1.5"
          >
            <select name="versionTypeId" defaultValue={v.versionTypeId} className={`${inputCls} w-auto`}>
              {versionTypes.map((vt) => (
                <option key={vt.id} value={vt.id} className="bg-charbon-800">{vt.label}</option>
              ))}
            </select>
            <select name="language" defaultValue={v.language} className={`${inputCls} w-auto`}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-charbon-800">{l}</option>
              ))}
            </select>
            <select name="editionLabel" defaultValue={v.editionLabel ? "1ère édition" : ""} className={`${inputCls} w-auto`} title={t("editionLabel")}>
              <option value="" className="bg-charbon-800">{t("editionReedition")}</option>
              <option value="1ère édition" className="bg-charbon-800">{t("editionFirst")}</option>
            </select>
            <button type="submit" disabled={pending} className="rounded-md bg-charbon-600 px-2.5 py-1.5 text-[10.5px] font-extrabold text-blanc-casse uppercase disabled:opacity-50">{t("save")}</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeVariant(v)}
              className="text-[10.5px] font-bold text-neon-rouge hover:underline disabled:opacity-50"
            >
              {t("delete")}
            </button>
          </form>
        ))}
      </div>

      {adding ? (
        <form action={(fd) => add(fd)} className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-or/30 bg-charbon-800 px-2 py-2">
          <select name="versionTypeId" required className={`${inputCls} w-auto`}>
            {versionTypes.map((vt) => (
              <option key={vt.id} value={vt.id} className="bg-charbon-800">{vt.label}</option>
            ))}
          </select>
          <select name="language" defaultValue="FR" className={`${inputCls} w-auto`}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="bg-charbon-800">{l}</option>
            ))}
          </select>
          <select name="editionLabel" defaultValue="" className={`${inputCls} w-auto`} title={t("editionLabel")}>
            <option value="" className="bg-charbon-800">{t("editionReedition")}</option>
            <option value="1ère édition" className="bg-charbon-800">{t("editionFirst")}</option>
          </select>
          <button type="submit" disabled={pending} className="rounded-md bg-or px-2.5 py-1.5 text-[10.5px] font-extrabold text-charbon uppercase disabled:opacity-50">{t("create")}</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[10.5px] font-bold text-texte-dim">{t("cancel")}</button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 text-[11px] font-extrabold text-or uppercase hover:underline">
          + {t("addVariant")}
        </button>
      )}
      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin";

function ImageUrlField({
  defaultValue = "",
  className,
  uploadMode,
}: {
  defaultValue?: string;
  className?: string;
  uploadMode: AdminImageUploadMode;
}) {
  const t = useTranslations("admin.catalog");
  const [value, setValue] = useState(defaultValue);
  const [failed, setFailed] = useState(false);

  const trimmed = value.trim();
  const src = trimmed ? cardImage(trimmed) : null;

  return (
    <Field label={t("image")} hint={t("imageDropHint")} className={className}>
      <AdminImageDropzone
        scope="catalog"
        uploadMode={uploadMode}
        compact
        onUploaded={(fileName) => {
          setValue(fileName);
          setFailed(false);
        }}
      />
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <input
          name="imageUrl"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setFailed(false);
          }}
          placeholder={t("imagePlaceholder")}
          className={`${inputCls} w-full min-w-0 flex-1 sm:min-w-[220px]`}
        />
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div
            className="relative aspect-5/7 w-[96px] overflow-hidden rounded-lg border border-charbon-500 bg-charbon-900 shadow-inner"
            aria-live="polite"
          >
            {src && !failed ? (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu admin temps réel (fichiers /uploads locaux)
              <img
                key={src}
                src={src}
                alt={t("imagePreviewAlt")}
                className="h-full w-full object-cover"
                onError={() => setFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] leading-snug font-bold text-texte-faible">
                {!trimmed ? t("imagePreviewEmpty") : t("imagePreviewError")}
              </div>
            )}
          </div>
          <span className="text-[9px] font-extrabold tracking-wide text-texte-dim uppercase">{t("imagePreview")}</span>
        </div>
      </div>
    </Field>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[10px] font-extrabold tracking-wide text-texte-dim uppercase">{label}</label>
      {hint && <p className="mt-0.5 text-[10px] font-bold text-texte-faible">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
