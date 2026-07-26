"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { cardImage, rarityMeta } from "@/lib/rarity";
import type {
  AdminCatalogSeason,
  AdminCardFull,
  AdminCardListItem,
  AdminCardSetOption,
  AdminRarityOption,
  AdminVariantRow,
  AdminVersionTypeOption,
} from "@/server/admin/admin.mutations";
import { updateSeasonAction } from "@/server/admin/shop.actions";
import {
  getCardDetailAction,
  createCardAction,
  updateCardAction,
  deleteCardAction,
  createCardVariantAction,
  updateCardVariantAction,
  deleteCardVariantAction,
  createCardSetAction,
  updateCardSetAction,
  deleteCardSetAction,
} from "@/server/admin/catalog.actions";
import { AdminImageDropzone } from "@/components/admin/admin-image-dropzone";
import type { AdminImageUploadMode } from "@/lib/admin-image-upload.types";
import {
  AdminFilterBar,
  AdminFilterSelect,
  matchAdminSearch,
} from "@/components/admin/admin-filter-bar";
import { isHorsSerieSeasonCode } from "@/lib/seasons";

const LANGUAGES = ["FR", "EN", "JP", "DE", "US"] as const;

/** Nombre de lignes affichées d'emblée par saison — le reste se révèle à la demande. */
const PAGE_SIZE = 40;

type SortKey = "numberAsc" | "numberDesc" | "nameAsc" | "quoteDesc" | "rarity";

const num = (fd: FormData, k: string): number | undefined => {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return undefined;
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};
const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string): string | null => str(fd, k) || null;

const inputCls =
  "w-full rounded-lg border border-charbon-500 bg-charbon-700 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin";

export function AdminCatalogManager({
  seasons: initialSeasons,
  rarities,
  versionTypes,
  cardSets,
  uploadMode,
}: {
  seasons: AdminCatalogSeason[];
  rarities: AdminRarityOption[];
  versionTypes: AdminVersionTypeOption[];
  cardSets: AdminCardSetOption[];
  uploadMode: AdminImageUploadMode;
}) {
  const t = useTranslations("admin.catalog");
  const tFilters = useTranslations("admin.filters");

  // Le catalogue vit côté client après le premier rendu : chaque mutation patche cet
  // état avec la carte fraîche renvoyée par l'action, ce qui met l'UI à jour tout de
  // suite sans perdre les filtres ni la fiche ouverte. Les revalidations serveur
  // finissent par renvoyer un payload RSC neuf — l'effet réaligne alors l'état dessus.
  const [seasons, setSeasons] = useState(initialSeasons);
  useEffect(() => setSeasons(initialSeasons), [initialSeasons]);

  // Les collections vivent hors des saisons (elles les traversent) : même
  // stratégie, l'état local suit les retours d'action puis se réaligne sur le RSC.
  const [sets, setSets] = useState(cardSets);
  useEffect(() => setSets(cardSets), [cardSets]);

  // Cache des fiches complètes, alimenté à l'ouverture d'un éditeur.
  const [details, setDetails] = useState<Record<string, AdminCardFull>>({});
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const [openSeasons, setOpenSeasons] = useState<Set<string>>(
    () => new Set(initialSeasons.map((s) => s.id)),
  );
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("numberAsc");

  const rarityById = useMemo(() => new Map(rarities.map((r) => [r.id, r])), [rarities]);
  const rarityRank = useMemo(() => new Map(rarities.map((r, i) => [r.id, i])), [rarities]);

  const totalCards = useMemo(() => seasons.reduce((sum, s) => sum + s.cards.length, 0), [seasons]);

  const filteredSeasons = useMemo(() => {
    const hasCardFilter = Boolean(q.trim() || rarityFilter);
    const compare = cardComparator(sort, rarityRank);
    return seasons
      .filter((s) => !seasonFilter || s.id === seasonFilter)
      .map((s) => {
        const cards = s.cards.filter((c) => {
          if (rarityFilter && c.rarityId !== rarityFilter) return false;
          return matchAdminSearch(q, c.name, c.number, c.country, c.brand, c.slug);
        });
        return { season: s, cards: cards.sort(compare) };
      })
      .filter((entry) => !hasCardFilter || entry.cards.length > 0);
  }, [seasons, q, seasonFilter, rarityFilter, sort, rarityRank]);

  const resultCount = useMemo(
    () => filteredSeasons.reduce((sum, e) => sum + e.cards.length, 0),
    [filteredSeasons],
  );

  const hasFilters = Boolean(q.trim() || seasonFilter || rarityFilter);
  const visibleOpenSeasons = hasFilters
    ? new Set(filteredSeasons.map((e) => e.season.id))
    : openSeasons;

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
    setSort("numberAsc");
  }

  const cacheDetail = useCallback((detail: AdminCardFull) => {
    setDetails((prev) => ({ ...prev, [detail.id]: detail }));
  }, []);

  /** Insère ou remplace une ligne, en gérant un éventuel changement de saison. */
  const upsertCard = useCallback((seasonId: string, card: AdminCardListItem) => {
    setSeasons((prev) =>
      prev.map((s) => {
        const without = s.cards.filter((c) => c.id !== card.id);
        if (s.id !== seasonId) {
          return without.length === s.cards.length ? s : { ...s, cards: without };
        }
        return { ...s, cards: [...without, card].sort((a, b) => a.number - b.number) };
      }),
    );
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setSeasons((prev) =>
      prev.map((s) => {
        const without = s.cards.filter((c) => c.id !== cardId);
        return without.length === s.cards.length ? s : { ...s, cards: without };
      }),
    );
    setDetails((prev) => {
      if (!prev[cardId]) return prev;
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setOpenCardId((cur) => (cur === cardId ? null : cur));
  }, []);

  const applyVariants = useCallback((cardId: string, variants: AdminVariantRow[]) => {
    setDetails((prev) =>
      prev[cardId] ? { ...prev, [cardId]: { ...prev[cardId], variants } } : prev,
    );
    setSeasons((prev) =>
      prev.map((s) => {
        if (!s.cards.some((c) => c.id === cardId)) return s;
        return {
          ...s,
          cards: s.cards.map((c) =>
            c.id === cardId ? { ...c, variantCount: variants.length } : c,
          ),
        };
      }),
    );
  }, []);

  const patchSeason = useCallback((seasonId: string, data: Partial<AdminCatalogSeason>) => {
    setSeasons((prev) => prev.map((s) => (s.id === seasonId ? { ...s, ...data } : s)));
  }, []);

  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const toggleCard = useCallback(
    (cardId: string) => {
      setDetailError(null);
      if (openCardId === cardId) {
        setOpenCardId(null);
        return;
      }
      setOpenCardId(cardId);
      if (details[cardId]) return;
      setLoadingCardId(cardId);
      void getCardDetailAction({ cardId })
        .then((res) => {
          if (res.ok) cacheDetail(res.detail);
          else setDetailError(res.error);
        })
        .catch(() => setDetailError("UNKNOWN"))
        .finally(() => setLoadingCardId((cur) => (cur === cardId ? null : cur)));
    },
    [openCardId, details, cacheDetail],
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminFilterBar
        live
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t("searchPlaceholder")}
        onReset={hasFilters || sort !== "numberAsc" ? resetFilters : undefined}
      >
        <AdminFilterSelect
          label={t("filterSeason")}
          value={seasonFilter}
          onChange={setSeasonFilter}
          options={[
            { value: "", label: t("seasonAll") },
            ...seasons.map((s) => ({ value: s.id, label: seasonLabel(s, t) })),
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
        <AdminFilterSelect
          label={t("sort")}
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={[
            { value: "numberAsc", label: t("sortNumberAsc") },
            { value: "numberDesc", label: t("sortNumberDesc") },
            { value: "nameAsc", label: t("sortNameAsc") },
            { value: "quoteDesc", label: t("sortQuoteDesc") },
            { value: "rarity", label: t("sortRarity") },
          ]}
        />
      </AdminFilterBar>

      <p className="text-texte-faible text-[12px] font-bold">
        {hasFilters
          ? tFilters("resultsCount", { count: resultCount })
          : t("catalogTotal", { seasons: seasons.length, cards: totalCards })}
      </p>

      <CardSetsPanel sets={sets} onChange={setSets} />

      {detailError && (
        <p className="border-neon-rouge/40 bg-neon-rouge/10 text-neon-rouge rounded-lg border px-3 py-2 text-[12px] font-bold">
          {t("errLoadCard")}
        </p>
      )}

      {filteredSeasons.length === 0 ? (
        <p className="border-charbon-500 bg-charbon-800 text-texte-dim rounded-[14px] border px-4 py-8 text-center text-[13px] font-bold">
          {tFilters("noResults")}
        </p>
      ) : (
        filteredSeasons.map(({ season, cards }) => {
          const open = visibleOpenSeasons.has(season.id);
          const limit = limits[season.id] ?? PAGE_SIZE;
          const shown = cards.slice(0, limit);
          const rest = cards.length - shown.length;

          return (
            <section
              key={season.id}
              className={`rounded-[16px] border p-5 ${
                isHorsSerieSeasonCode(season.code)
                  ? "border-or/45 from-or/8 to-charbon-800 bg-gradient-to-br"
                  : "border-charbon-500 bg-charbon-800"
              }`}
            >
              <SeasonHeader
                season={season}
                shownCount={cards.length}
                totalCount={season.cards.length}
                open={open}
                onToggle={() => toggleSeason(season.id)}
                onSaved={(data) => patchSeason(season.id, data)}
              />

              {open && (
                <div className="mt-5 flex flex-col gap-3">
                  <NewCardForm
                    seasonId={season.id}
                    seasonCode={season.code}
                    rarities={rarities}
                    uploadMode={uploadMode}
                    onCreated={(seasonId, card, detail) => {
                      upsertCard(seasonId, card);
                      cacheDetail(detail);
                    }}
                  />

                  {cards.length === 0 ? (
                    <p className="text-texte-faible text-[12px] font-bold">{t("noCards")}</p>
                  ) : (
                    <>
                      <ListHeader />
                      <ul className="flex flex-col gap-1.5">
                        {shown.map((card) => (
                          <li key={card.id}>
                            <CardRow
                              card={card}
                              rarity={rarityById.get(card.rarityId)}
                              open={openCardId === card.id}
                              onToggle={() => toggleCard(card.id)}
                            />
                            {openCardId === card.id && (
                              <div className="border-carmin/35 bg-charbon-700/40 mt-1.5 rounded-[14px] border p-4">
                                {details[card.id] ? (
                                  <CardEditor
                                    key={card.id}
                                    detail={details[card.id]}
                                    seasonCode={season.code}
                                    seasons={seasons}
                                    rarities={rarities}
                                    versionTypes={versionTypes}
                                    cardSets={sets}
                                    uploadMode={uploadMode}
                                    onSaved={(seasonId, row, detail) => {
                                      upsertCard(seasonId, row);
                                      cacheDetail(detail);
                                    }}
                                    onDeleted={() => removeCard(card.id)}
                                    onVariantsChanged={(variants) =>
                                      applyVariants(card.id, variants)
                                    }
                                  />
                                ) : (
                                  <p className="text-texte-faible py-6 text-center text-[12px] font-bold">
                                    {loadingCardId === card.id
                                      ? t("loadingCard")
                                      : t("errLoadCard")}
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                      {rest > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setLimits((prev) => ({ ...prev, [season.id]: limit + PAGE_SIZE }))
                          }
                          className="border-charbon-500 text-texte-dim hover:border-or hover:text-or mx-auto rounded-lg border px-4 py-2 text-[11px] font-extrabold tracking-wide uppercase"
                        >
                          {t("showMore", { count: rest })}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function cardComparator(sort: SortKey, rarityRank: Map<string, number>) {
  return (a: AdminCardListItem, b: AdminCardListItem): number => {
    switch (sort) {
      case "numberDesc":
        return b.number - a.number;
      case "nameAsc":
        return a.name.localeCompare(b.name);
      case "quoteDesc":
        return b.quoteValue - a.quoteValue || a.number - b.number;
      case "rarity":
        return (
          (rarityRank.get(a.rarityId) ?? 99) - (rarityRank.get(b.rarityId) ?? 99) ||
          a.number - b.number
        );
      default:
        return a.number - b.number;
    }
  };
}

function seasonLabel(
  s: { code: string; name: string },
  t: ReturnType<typeof useTranslations>,
): string {
  return isHorsSerieSeasonCode(s.code) ? t("horsSerieLabel") : `${s.code} · ${s.name}`;
}

/** Grille partagée entre l'en-tête de liste et les lignes, pour garder les colonnes alignées. */
const rowGrid =
  "grid grid-cols-[34px_1fr_auto] items-center gap-3 md:grid-cols-[34px_52px_1fr_150px_92px_74px_20px]";

function ListHeader() {
  const t = useTranslations("admin.catalog");
  return (
    <div
      className={`${rowGrid} text-texte-faible px-3 pb-1 text-[9.5px] font-extrabold tracking-wide uppercase`}
    >
      <span aria-hidden />
      <span className="hidden md:block">{t("number")}</span>
      <span>{t("colCard")}</span>
      <span className="hidden md:block">{t("rarity")}</span>
      <span className="hidden text-right md:block">{t("quote")}</span>
      <span className="hidden text-right md:block">{t("colVariants")}</span>
      <span aria-hidden className="hidden md:block" />
    </div>
  );
}

function CardRow({
  card,
  rarity,
  open,
  onToggle,
}: {
  card: AdminCardListItem;
  rarity: AdminRarityOption | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("admin.catalog");
  const format = useFormatter();
  const meta = rarity ? rarityMeta(rarity.code) : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`${rowGrid} w-full rounded-lg border px-3 py-2 text-left transition-colors ${
        open
          ? "border-carmin/60 bg-charbon-700"
          : "border-charbon-500/60 bg-charbon-700/25 hover:border-charbon-500 hover:bg-charbon-700/60"
      }`}
    >
      <span className="border-charbon-500 bg-charbon-900 relative block aspect-5/7 w-[34px] overflow-hidden rounded-[3px] border">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette admin (fichiers /uploads ou CDN, pas de layout shift)
          <img
            src={cardImage(card.imageUrl)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </span>

      <span className="text-or hidden font-mono text-[12px] font-bold md:block">
        {String(card.number).padStart(3, "0")}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-blanc-casse truncate text-[13px] font-bold">{card.name}</span>
        <span className="text-texte-faible flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          <span className="text-or font-mono md:hidden">
            {String(card.number).padStart(3, "0")}
          </span>
          {card.brand && <span>{card.brand}</span>}
          {card.country && (
            <span className="bg-charbon-600 rounded px-1 py-px uppercase">{card.country}</span>
          )}
          {card.isUnique && (
            <span className="bg-or/20 text-or rounded px-1 py-px font-extrabold tracking-wide uppercase">
              {t("uniqueBadge")}
            </span>
          )}
        </span>
      </span>

      <span
        className="hidden items-center gap-1.5 text-[11.5px] font-bold md:flex"
        style={{ color: meta?.color }}
      >
        {meta && <span aria-hidden>{meta.glyph}</span>}
        <span className="truncate">{rarity?.label ?? "—"}</span>
      </span>

      <span className="text-texte-doux hidden text-right font-mono text-[12px] md:block">
        {format.number(card.quoteValue, { style: "currency", currency: "EUR" })}
      </span>

      <span className="text-texte-faible hidden text-right text-[11px] font-bold md:block">
        {t("variantsShort", { count: card.variantCount })}
      </span>

      <span className="text-texte-dim text-[12px]" aria-hidden>
        {open ? "▾" : "▸"}
      </span>
    </button>
  );
}

function useAction() {
  const t = useTranslations("admin.catalog");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function run<T extends { ok: boolean; error?: string }>(
    fn: () => Promise<T>,
    onSuccess?: (res: T & { ok: true }) => void,
    successMsg?: string,
  ) {
    setError(null);
    setSuccess(null);
    startTransition(() => {
      void (async () => {
        try {
          const res = await fn();
          if (res.ok) {
            onSuccess?.(res as T & { ok: true });
            if (successMsg) {
              setSuccess(successMsg);
              setTimeout(() => setSuccess(null), 1800);
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

  return { pending, error, success, run, setError };
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
    case "SET_EXISTS":
      return t("errSetExists");
    case "SET_NOT_EMPTY":
      return t("errSetNotEmpty");
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

/**
 * Gestion des collections (CardSet).
 *
 * Hors de l'arbre des saisons : une collection les traverse, elle ne s'y range
 * pas. Le rattachement des cartes se fait carte par carte, dans l'éditeur de
 * variantes — c'est là que vit le choix « quelle version, dans quelle collection ».
 */
function CardSetsPanel({
  sets,
  onChange,
}: {
  sets: AdminCardSetOption[];
  onChange: (sets: AdminCardSetOption[]) => void;
}) {
  const t = useTranslations("admin.catalog");
  const { pending, error, success, run } = useAction();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  function create(fd: FormData) {
    run(
      () =>
        createCardSetAction({
          code: str(fd, "code"),
          name: str(fd, "name"),
          seriesCode: optStr(fd, "seriesCode"),
          sortOrder: num(fd, "sortOrder"),
        }),
      (res) => {
        onChange(res.sets);
        setAdding(false);
      },
      t("setCreated"),
    );
  }

  function remove(s: AdminCardSetOption) {
    if (!confirm(t("confirmDeleteSet", { name: s.name }))) return;
    run(
      () => deleteCardSetAction({ setId: s.id }),
      (res) => onChange(res.sets),
    );
  }

  return (
    <section className="border-charbon-500 bg-charbon-800 rounded-[16px] border p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <span className="font-display text-blanc-casse text-[15px] tracking-[1.5px] uppercase">
          {t("setsTitle")}
        </span>
        <span className="border-charbon-500 text-texte-dim rounded-full border px-2 py-0.5 text-[11px] font-extrabold">
          {sets.length}
        </span>
        <span className="text-texte-faible ml-auto text-[11px] font-bold">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-texte-faible text-[11.5px] font-bold">{t("setsHint")}</p>

          {sets.length === 0 && (
            <p className="text-texte-faible text-[12px] font-bold">{t("noSets")}</p>
          )}

          {sets.map((s) => (
            <form
              key={s.id}
              action={(fd) =>
                run(
                  () =>
                    updateCardSetAction({
                      setId: s.id,
                      code: str(fd, "code"),
                      name: str(fd, "name"),
                      seriesCode: optStr(fd, "seriesCode"),
                      sortOrder: num(fd, "sortOrder"),
                    }),
                  (res) => onChange(res.sets),
                )
              }
              className="bg-charbon-900/40 flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5"
            >
              <input
                name="code"
                defaultValue={s.code}
                required
                maxLength={32}
                title={t("setCode")}
                className={`${inputCls} w-auto max-w-[120px]`}
              />
              <input
                name="name"
                defaultValue={s.name}
                required
                maxLength={80}
                title={t("setName")}
                className={`${inputCls} w-auto max-w-[220px]`}
              />
              <input
                name="seriesCode"
                defaultValue={s.seriesCode ?? ""}
                maxLength={8}
                placeholder={t("setSeriesCode")}
                title={t("setSeriesCode")}
                className={`${inputCls} w-auto max-w-[100px]`}
              />
              <input
                name="sortOrder"
                type="number"
                defaultValue={s.sortOrder}
                min={0}
                max={999}
                title={t("setSortOrder")}
                className={`${inputCls} w-auto max-w-[80px]`}
              />
              <span className="text-texte-faible text-[11px] font-bold">
                {t("setVariantCount", { count: s.variantCount })}
              </span>
              <button
                type="submit"
                disabled={pending}
                className="bg-charbon-600 text-blanc-casse ml-auto rounded-md px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase disabled:opacity-50"
              >
                {t("save")}
              </button>
              <button
                type="button"
                disabled={pending || s.variantCount > 0}
                onClick={() => remove(s)}
                title={s.variantCount > 0 ? t("errSetNotEmpty") : undefined}
                className="text-neon-rouge text-[10.5px] font-bold hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {t("delete")}
              </button>
            </form>
          ))}

          {adding ? (
            <form
              action={(fd) => create(fd)}
              className="border-or/30 bg-charbon-900/40 flex flex-wrap items-center gap-2 rounded-md border px-2 py-2"
            >
              <input
                name="code"
                required
                maxLength={32}
                placeholder={t("setCode")}
                className={`${inputCls} w-auto max-w-[120px]`}
              />
              <input
                name="name"
                required
                maxLength={80}
                placeholder={t("setName")}
                className={`${inputCls} w-auto max-w-[220px]`}
              />
              <input
                name="seriesCode"
                maxLength={8}
                placeholder={t("setSeriesCode")}
                className={`${inputCls} w-auto max-w-[100px]`}
              />
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                min={0}
                max={999}
                title={t("setSortOrder")}
                className={`${inputCls} w-auto max-w-[80px]`}
              />
              <button
                type="submit"
                disabled={pending}
                className="bg-carmin rounded-md px-3 py-1.5 text-[10.5px] font-extrabold text-white uppercase disabled:opacity-50"
              >
                {t("create")}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-texte-dim text-[10.5px] font-bold hover:underline"
              >
                {t("cancel")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="border-or/40 text-or hover:bg-or/10 self-start rounded-md border border-dashed px-3 py-1.5 text-[11px] font-extrabold"
            >
              {t("addSet")}
            </button>
          )}

          {error && <p className="text-neon-rouge text-[11px] font-bold">{error}</p>}
          {success && <p className="text-statut-succes text-[11px] font-bold">{success}</p>}
        </div>
      )}
    </section>
  );
}

function SeasonHeader({
  season,
  shownCount,
  totalCount,
  open,
  onToggle,
  onSaved,
}: {
  season: AdminCatalogSeason;
  shownCount: number;
  totalCount: number;
  open: boolean;
  onToggle: () => void;
  onSaved: (data: Partial<AdminCatalogSeason>) => void;
}) {
  const t = useTranslations("admin.catalog");
  const { pending, error, success, run } = useAction();
  const horsSerie = isHorsSerieSeasonCode(season.code);

  function save(fd: FormData) {
    const releaseRaw = str(fd, "releaseDate");
    const name = str(fd, "name");
    const seriesCode = str(fd, "seriesCode");
    const releaseDate = releaseRaw ? new Date(releaseRaw) : null;
    run(
      () =>
        updateSeasonAction({
          seasonId: season.id,
          name,
          releaseDate: releaseDate ? releaseDate.toISOString() : null,
          seriesCode,
        }),
      () => onSaved({ name, seriesCode: seriesCode || null, releaseDate }),
      t("saved"),
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <button
        type="button"
        onClick={onToggle}
        className="font-display border-charbon-500 text-or hover:border-or flex h-9 w-9 items-center justify-center rounded-lg border text-[16px]"
        aria-label={open ? t("collapse") : t("expand")}
        aria-expanded={open}
      >
        {open ? "−" : "+"}
      </button>
      <div>
        <label className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
          {t("code")}
        </label>
        <p className="text-or font-mono text-[14px]">{season.code}</p>
        {horsSerie && (
          <span className="bg-or/15 text-or mt-1 inline-block rounded-md px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase">
            {t("horsSerieBadge")}
          </span>
        )}
      </div>
      <form
        action={(fd) => save(fd)}
        className="flex w-full flex-1 flex-col flex-wrap items-stretch gap-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 sm:min-w-[160px]">
          <label className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
            {t("name")}
          </label>
          <input
            name="name"
            defaultValue={season.name}
            className="border-charbon-500 bg-charbon-700 text-blanc-casse mt-1 w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div className="w-full sm:w-[110px]">
          <label className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
            {t("seriesCode")}
          </label>
          <input
            name="seriesCode"
            defaultValue={season.seriesCode ?? ""}
            maxLength={4}
            placeholder="MF"
            title={t("seriesCodeHint")}
            className="border-charbon-500 bg-charbon-700 text-blanc-casse mt-1 w-full rounded-lg border px-3 py-2 font-mono tracking-wide uppercase"
          />
        </div>
        <div>
          <label className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
            {t("cards")}
          </label>
          <p className="text-blanc-casse text-[14px] font-bold">
            {shownCount === totalCount ? totalCount : `${shownCount} / ${totalCount}`}
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <label className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
            {t("release")}
          </label>
          <input
            name="releaseDate"
            type="datetime-local"
            defaultValue={season.releaseDate ? toLocalInput(season.releaseDate) : ""}
            className="border-charbon-500 bg-charbon-700 text-blanc-casse mt-1 w-full rounded-lg border px-3 py-2 sm:w-auto"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-carmin rounded-lg px-4 py-2 text-[12px] font-extrabold text-white uppercase disabled:opacity-50"
        >
          {t("save")}
        </button>
      </form>
      {error && <p className="text-neon-rouge w-full text-[12px] font-bold">{error}</p>}
      {success && <p className="text-neon-vert w-full text-[12px] font-bold">{success}</p>}
    </div>
  );
}

/** `datetime-local` attend une date locale, pas un ISO UTC. */
function toLocalInput(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewCardForm({
  seasonId,
  seasonCode,
  rarities,
  uploadMode,
  onCreated,
}: {
  seasonId: string;
  seasonCode: string;
  rarities: AdminRarityOption[];
  uploadMode: AdminImageUploadMode;
  onCreated: (seasonId: string, card: AdminCardListItem, detail: AdminCardFull) => void;
}) {
  const t = useTranslations("admin.catalog");
  const [open, setOpen] = useState(false);
  const { pending, error, success, run } = useAction();
  const horsSerie = isHorsSerieSeasonCode(seasonCode);

  function submit(fd: FormData) {
    const cardNumber = num(fd, "number");
    const cardName = str(fd, "name");

    if (cardNumber === undefined) {
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
      (res) => {
        onCreated(res.seasonId, res.card, res.detail);
        setOpen(false);
      },
      t("createSuccess"),
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-display border-or/50 text-or hover:bg-or/10 w-fit rounded-lg border border-dashed px-4 py-2 text-[12px] tracking-wide uppercase"
      >
        + {t("newCard")}
      </button>
    );
  }

  return (
    <form
      action={(fd) => submit(fd)}
      className="border-or/30 bg-charbon-900/40 rounded-[14px] border p-4"
    >
      <h4 className="font-display text-or text-[13px] tracking-wide uppercase">{t("newCard")}</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("number")} hint={horsSerie ? t("numberHintHorsSerie") : t("numberHint")}>
          <input
            name="number"
            type="number"
            min={0}
            defaultValue=""
            placeholder={horsSerie ? "ex: 1" : "ex: 80"}
            className={inputCls}
          />
        </Field>
        <Field label={t("name")}>
          <input name="name" placeholder={t("namePlaceholder")} className={inputCls} />
        </Field>
        <Field label={t("rarity")}>
          <select name="rarityId" className={inputCls}>
            {rarities.map((r) => (
              <option key={r.id} value={r.id} className="bg-charbon-800">
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("quote")}>
          <input
            name="quoteValue"
            type="number"
            step="0.01"
            defaultValue={0}
            className={inputCls}
          />
        </Field>
        <Field label={t("country")}>
          <input name="country" maxLength={8} className={inputCls} />
        </Field>
        <Field label={t("brand")}>
          <input
            name="brand"
            maxLength={60}
            placeholder={t("brandPlaceholder")}
            className={inputCls}
          />
        </Field>
        <ImageUrlField uploadMode={uploadMode} className="sm:col-span-2 lg:col-span-3" />
        <Field label={t("description")} className="sm:col-span-2 lg:col-span-3">
          <textarea name="description" rows={3} className={`${inputCls} resize-none`} />
        </Field>
      </div>
      <label className="text-texte-doux mt-3 flex items-center gap-2 text-[12px] font-bold">
        <input type="checkbox" name="isUnique" className="accent-carmin" /> {t("isUnique")}
      </label>
      {error && <p className="text-neon-rouge mt-2 text-[12px] font-bold">{error}</p>}
      {success && <p className="text-neon-vert mt-2 text-[12px] font-bold">{success}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-or text-charbon rounded-lg px-4 py-2 text-[11px] font-extrabold uppercase disabled:opacity-50"
        >
          {t("create")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border-charbon-500 text-texte-dim rounded-lg border px-4 py-2 text-[11px] font-extrabold uppercase"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function CardEditor({
  detail,
  seasonCode,
  seasons,
  rarities,
  versionTypes,
  cardSets,
  uploadMode,
  onSaved,
  onDeleted,
  onVariantsChanged,
}: {
  detail: AdminCardFull;
  seasonCode: string;
  seasons: AdminCatalogSeason[];
  rarities: AdminRarityOption[];
  versionTypes: AdminVersionTypeOption[];
  cardSets: AdminCardSetOption[];
  uploadMode: AdminImageUploadMode;
  onSaved: (seasonId: string, card: AdminCardListItem, detail: AdminCardFull) => void;
  onDeleted: () => void;
  onVariantsChanged: (variants: AdminVariantRow[]) => void;
}) {
  const t = useTranslations("admin.catalog");
  const { pending, error, success, run } = useAction();
  const horsSerie = isHorsSerieSeasonCode(seasonCode);

  function save(fd: FormData) {
    run(
      () =>
        updateCardAction({
          cardId: detail.id,
          seasonId: str(fd, "seasonId"),
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
      (res) => onSaved(res.seasonId, res.card, res.detail),
      t("saved"),
    );
  }

  function remove() {
    if (!confirm(t("confirmDeleteCard", { name: detail.name }))) return;
    run(
      () => deleteCardAction({ cardId: detail.id }),
      () => onDeleted(),
    );
  }

  return (
    <>
      <form action={(fd) => save(fd)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("number")} hint={horsSerie ? t("numberHintHorsSerie") : t("numberHint")}>
          <input
            name="number"
            type="number"
            min={0}
            defaultValue={detail.number}
            className={inputCls}
          />
        </Field>
        <Field label={t("name")}>
          <input name="name" defaultValue={detail.name} className={inputCls} />
        </Field>
        <Field label={t("filterSeason")}>
          <select name="seasonId" defaultValue={detail.seasonId} className={inputCls}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id} className="bg-charbon-800">
                {seasonLabel(s, t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("rarity")}>
          <select name="rarityId" defaultValue={detail.rarityId} className={inputCls}>
            {rarities.map((r) => (
              <option key={r.id} value={r.id} className="bg-charbon-800">
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("quote")}>
          <input
            name="quoteValue"
            type="number"
            step="0.01"
            defaultValue={detail.quoteValue}
            className={inputCls}
          />
        </Field>
        <Field label={t("power")}>
          <input
            name="powerCh"
            type="number"
            defaultValue={detail.powerCh ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label={t("weight")}>
          <input
            name="weightKg"
            type="number"
            defaultValue={detail.weightKg ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label={t("country")}>
          <input
            name="country"
            maxLength={8}
            defaultValue={detail.country ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label={t("brand")}>
          <input
            name="brand"
            maxLength={60}
            defaultValue={detail.brand ?? ""}
            placeholder={t("brandPlaceholder")}
            className={inputCls}
          />
        </Field>
        <ImageUrlField
          uploadMode={uploadMode}
          key={`${detail.id}-${detail.imageUrl ?? ""}`}
          defaultValue={detail.imageUrl ?? ""}
          className="sm:col-span-2 lg:col-span-3"
        />
        <Field label={t("description")} className="sm:col-span-2 lg:col-span-4">
          <textarea
            name="description"
            defaultValue={detail.description ?? ""}
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>
        <label className="text-texte-doux flex items-center gap-2 text-[12px] font-bold">
          <input
            type="checkbox"
            name="isUnique"
            defaultChecked={detail.isUnique}
            className="accent-carmin"
          />{" "}
          {t("isUnique")}
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
          {success && (
            <span className="text-neon-vert mr-auto text-[12px] font-bold">{success}</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="bg-carmin rounded-lg px-4 py-2 text-[11px] font-extrabold text-white uppercase disabled:opacity-50"
          >
            {t("save")}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="border-neon-rouge/50 text-neon-rouge hover:bg-neon-rouge/10 rounded-lg border px-4 py-2 text-[11px] font-extrabold uppercase disabled:opacity-50"
          >
            {t("delete")}
          </button>
        </div>
      </form>

      {error && <p className="text-neon-rouge mt-2 text-[12px] font-bold">{error}</p>}

      <CardVariants
        cardId={detail.id}
        variants={detail.variants}
        versionTypes={versionTypes}
        cardSets={cardSets}
        onChanged={onVariantsChanged}
      />
    </>
  );
}

function CardVariants({
  cardId,
  variants,
  versionTypes,
  cardSets,
  onChanged,
}: {
  cardId: string;
  variants: AdminVariantRow[];
  versionTypes: AdminVersionTypeOption[];
  cardSets: AdminCardSetOption[];
  onChanged: (variants: AdminVariantRow[]) => void;
}) {
  const t = useTranslations("admin.catalog");
  const { pending, error, run } = useAction();
  const [adding, setAdding] = useState(false);

  function add(fd: FormData) {
    run(
      () =>
        createCardVariantAction({
          cardId,
          versionTypeId: str(fd, "versionTypeId"),
          language: str(fd, "language"),
          setId: optStr(fd, "setId"),
        }),
      (res) => {
        onChanged(res.variants);
        setAdding(false);
      },
    );
  }

  function removeVariant(v: AdminVariantRow) {
    const label = [v.versionTypeLabel, v.language, v.setLabel].filter(Boolean).join(" · ");
    if (!confirm(t("confirmDeleteVariant", { label }))) return;
    run(
      () => deleteCardVariantAction({ variantId: v.id }),
      (res) => onChanged(res.variants),
    );
  }

  return (
    <div className="border-charbon-500 bg-charbon-900/40 mt-4 rounded-lg border p-3">
      <p className="text-texte-dim mb-2 text-[10px] font-extrabold tracking-wide uppercase">
        {t("variants")} ({variants.length})
      </p>
      <div className="flex flex-col gap-2">
        {variants.length === 0 && (
          <p className="text-texte-faible text-[11px] font-bold">{t("noVariants")}</p>
        )}
        {variants.map((v) => (
          <form
            key={v.id}
            action={(fd) =>
              run(
                () =>
                  updateCardVariantAction({
                    variantId: v.id,
                    versionTypeId: str(fd, "versionTypeId"),
                    language: str(fd, "language"),
                    setId: optStr(fd, "setId"),
                  }),
                (res) => onChanged(res.variants),
              )
            }
            className="bg-charbon-800 flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5"
          >
            <select
              name="versionTypeId"
              defaultValue={v.versionTypeId}
              className={`${inputCls} w-auto`}
            >
              {versionTypes.map((vt) => (
                <option key={vt.id} value={vt.id} className="bg-charbon-800">
                  {vt.label}
                </option>
              ))}
            </select>
            <select name="language" defaultValue={v.language} className={`${inputCls} w-auto`}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l} className="bg-charbon-800">
                  {l}
                </option>
              ))}
            </select>
            <select
              name="setId"
              defaultValue={v.setId ?? ""}
              className={`${inputCls} w-auto`}
              title={t("setLabel")}
            >
              <option value="" className="bg-charbon-800">
                {t("setNone")}
              </option>
              {cardSets.map((s) => (
                <option key={s.id} value={s.id} className="bg-charbon-800">
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="bg-charbon-600 text-blanc-casse rounded-md px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase disabled:opacity-50"
            >
              {t("save")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeVariant(v)}
              className="text-neon-rouge text-[10.5px] font-bold hover:underline disabled:opacity-50"
            >
              {t("delete")}
            </button>
          </form>
        ))}
      </div>

      {adding ? (
        <form
          action={(fd) => add(fd)}
          className="border-or/30 bg-charbon-800 mt-2 flex flex-wrap items-center gap-2 rounded-md border px-2 py-2"
        >
          <select name="versionTypeId" required className={`${inputCls} w-auto`}>
            {versionTypes.map((vt) => (
              <option key={vt.id} value={vt.id} className="bg-charbon-800">
                {vt.label}
              </option>
            ))}
          </select>
          <select name="language" defaultValue="FR" className={`${inputCls} w-auto`}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="bg-charbon-800">
                {l}
              </option>
            ))}
          </select>
          <select
            name="setId"
            defaultValue=""
            className={`${inputCls} w-auto`}
            title={t("setLabel")}
          >
            <option value="" className="bg-charbon-800">
              {t("setNone")}
            </option>
            {cardSets.map((s) => (
              <option key={s.id} value={s.id} className="bg-charbon-800">
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="bg-or text-charbon rounded-md px-2.5 py-1.5 text-[10.5px] font-extrabold uppercase disabled:opacity-50"
          >
            {t("create")}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-texte-dim text-[10.5px] font-bold"
          >
            {t("cancel")}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-or mt-2 text-[11px] font-extrabold uppercase hover:underline"
        >
          + {t("addVariant")}
        </button>
      )}
      {error && <p className="text-neon-rouge mt-2 text-[11px] font-bold">{error}</p>}
    </div>
  );
}

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
            className="border-charbon-500 bg-charbon-900 relative aspect-5/7 w-[96px] overflow-hidden rounded-lg border shadow-inner"
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
              <div className="text-texte-faible flex h-full w-full items-center justify-center px-2 text-center text-[10px] leading-snug font-bold">
                {!trimmed ? t("imagePreviewEmpty") : t("imagePreviewError")}
              </div>
            )}
          </div>
          <span className="text-texte-dim text-[9px] font-extrabold tracking-wide uppercase">
            {t("imagePreview")}
          </span>
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
      <label className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase">
        {label}
      </label>
      {hint && <p className="text-texte-faible mt-0.5 text-[10px] font-bold">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
