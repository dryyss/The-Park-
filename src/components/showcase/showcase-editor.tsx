"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShowcaseCard } from "@/components/showcase/showcase-card";
import type { PlaceableCard, ShowcaseCardView, ShowcaseView } from "@/server/showcase/showcase.service";
import {
  SHOWCASE_GRID_PRESETS,
  SHOWCASE_MAX_BINDERS,
  SHOWCASE_MAX_PAGES,
  SHOWCASE_MIN_PAGES,
  SHOWCASE_TITLE_MAX,
  slotsPerPage,
} from "@/lib/showcase";
import {
  createShowcaseAction,
  updateShowcaseConfigAction,
  deleteShowcaseAction,
  placeCardAction,
  moveItemAction,
  removeItemAction,
} from "@/server/showcase/showcase.actions";

type Draft = ShowcaseView[];

export function ShowcaseEditor({
  initialShowcases,
  placeable,
}: {
  initialShowcases: ShowcaseView[];
  placeable: PlaceableCard[];
}) {
  const t = useTranslations("showcase");
  const router = useRouter();

  const [showcases, setShowcases] = useState<Draft>(initialShowcases);
  const [activeId, setActiveId] = useState(initialShowcases[0]?.id ?? "");
  const [page, setPage] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  // Carte « prise » au tap pour être déplacée (méthode d'appoint, précise/accessible).
  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  // Drag par pointer events : fonctionne à la souris ET au tactile (le drag HTML5
  // natif ne marche pas sur mobile). `drag` = aperçu flottant qui suit le doigt.
  const [drag, setDrag] = useState<{ item: ShowcaseCardView; x: number; y: number } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const dragRef = useRef<{ item: ShowcaseCardView; startX: number; startY: number; active: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Le serveur reste la source de vérité : on resynchronise après chaque revalidation.
  useEffect(() => {
    setShowcases(initialShowcases);
  }, [initialShowcases]);

  const active = showcases.find((s) => s.id === activeId) ?? showcases[0];

  const errMsg = (code: string) => {
    const key = `err_${code}`;
    return t.has(key) ? t(key) : t("err_UNKNOWN");
  };

  /** Applique une mise à jour optimiste, joue l'action serveur, restaure en cas d'échec. */
  async function run(optimistic: Draft, action: () => Promise<{ ok: boolean; error?: string }>) {
    const snapshot = showcases;
    setShowcases(optimistic);
    setPending(true);
    setError(null);
    try {
      const res = await action();
      if (!res.ok) {
        setShowcases(snapshot);
        setError(errMsg(res.error ?? "UNKNOWN"));
      } else {
        router.refresh();
      }
    } catch {
      setShowcases(snapshot);
      setError(t("err_UNKNOWN"));
    } finally {
      setPending(false);
    }
  }

  // ---- Gestion des classeurs -------------------------------------------------

  async function createBinder() {
    if (showcases.length >= SHOWCASE_MAX_BINDERS || pending) return;
    setPending(true);
    setError(null);
    const res = await createShowcaseAction({ cols: 3, rows: 3, pageCount: 1 });
    if (res.ok) {
      const created: ShowcaseView = { id: res.data.id, title: null, visibility: "PUBLIC", cols: 3, rows: 3, pageCount: 1, items: [] };
      setShowcases((prev) => [...prev, created]);
      setActiveId(res.data.id);
      setPage(0);
      router.refresh();
    } else {
      setError(errMsg(res.error));
    }
    setPending(false);
  }

  function deleteBinder(id: string) {
    if (!window.confirm(t("deleteBinderConfirm"))) return;
    const next = showcases.filter((s) => s.id !== id);
    if (id === activeId) {
      setActiveId(next[0]?.id ?? "");
      setPage(0);
    }
    void run(next, () => deleteShowcaseAction(id));
  }

  function patchConfig(patch: {
    cols?: number;
    rows?: number;
    pageCount?: number;
    title?: string | null;
    visibility?: ShowcaseView["visibility"];
  }) {
    if (!active) return;
    const cols = patch.cols ?? active.cols;
    const rows = patch.rows ?? active.rows;
    const pageCount = patch.pageCount ?? active.pageCount;
    const maxSlot = slotsPerPage(cols, rows);
    const next = showcases.map((s) =>
      s.id === active.id
        ? {
            ...s,
            cols,
            rows,
            pageCount,
            title: patch.title === undefined ? s.title : patch.title,
            visibility: patch.visibility ?? s.visibility,
            items: s.items.filter((it) => it.page < pageCount && it.slot < maxSlot),
          }
        : s,
    );
    if (page >= pageCount) setPage(pageCount - 1);
    void run(next, () =>
      updateShowcaseConfigAction({ showcaseId: active.id, ...patch }),
    );
  }

  // ---- Placement / déplacement / retrait ------------------------------------

  const placedIds = useMemo(
    () => new Set(active?.items.map((it) => it.collectionItemId) ?? []),
    [active],
  );

  function firstFreeSlot(): number | null {
    if (!active) return null;
    const total = slotsPerPage(active.cols, active.rows);
    const taken = new Set(active.items.filter((it) => it.page === page).map((it) => it.slot));
    for (let i = 0; i < total; i++) if (!taken.has(i)) return i;
    return null;
  }

  function placeCard(card: PlaceableCard) {
    if (!active || pending) return;
    const slot = selectedSlot ?? firstFreeSlot();
    if (slot == null) {
      setError(t("err_OUT_OF_BOUNDS"));
      return;
    }
    const tempId = `temp-${card.collectionItemId}`;
    const next = showcases.map((s) => {
      if (s.id !== active.id) return s;
      const kept = s.items.filter(
        (it) => it.collectionItemId !== card.collectionItemId && !(it.page === page && it.slot === slot),
      );
      return {
        ...s,
        items: [
          ...kept,
          {
            itemId: tempId,
            collectionItemId: card.collectionItemId,
            page,
            slot,
            name: card.name,
            slug: card.slug,
            image: card.image,
            color: card.color,
            glyph: card.glyph,
            numberLabel: card.numberLabel,
          },
        ],
      };
    });
    setSelectedSlot(null);
    void run(next, () =>
      placeCardAction({ showcaseId: active.id, collectionItemId: card.collectionItemId, page, slot }),
    );
  }

  function moveItem(itemId: string, targetSlot: number) {
    if (!active || pending) return;
    const moving = active.items.find((it) => it.itemId === itemId);
    if (!moving) return;
    if (moving.page === page && moving.slot === targetSlot) return;
    const occupant = active.items.find((it) => it.page === page && it.slot === targetSlot);
    const next = showcases.map((s) => {
      if (s.id !== active.id) return s;
      return {
        ...s,
        items: s.items.map((it) => {
          if (it.itemId === moving.itemId) return { ...it, page, slot: targetSlot };
          if (occupant && it.itemId === occupant.itemId) return { ...it, page: moving.page, slot: moving.slot };
          return it;
        }),
      };
    });
    void run(next, () => moveItemAction({ showcaseId: active.id, itemId, page, slot: targetSlot }));
  }

  // ---- Drag par pointer events (souris + tactile) ---------------------------

  function slotUnderPointer(clientX: number, clientY: number): number | null {
    const el = (document.elementFromPoint(clientX, clientY) as HTMLElement | null)?.closest("[data-slot]") as
      | HTMLElement
      | null;
    if (!el) return null;
    const s = Number(el.dataset.slot);
    return Number.isFinite(s) ? s : null;
  }

  function onSlotPointerDown(e: React.PointerEvent, item?: ShowcaseCardView) {
    if (pending || !item) return; // seul un emplacement occupé démarre un drag
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { item, startX: e.clientX, startY: e.clientY, active: false };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }

  function onSlotPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return; // seuil anti-tap
      d.active = true;
      setPickedItemId(null);
      setSelectedSlot(null);
      setDrag({ item: d.item, x: e.clientX, y: e.clientY });
    }
    e.preventDefault();
    setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    setDragOverSlot(slotUnderPointer(e.clientX, e.clientY));
  }

  function onSlotPointerUp(e: React.PointerEvent, slot: number, item?: ShowcaseCardView) {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // 1) Vrai déplacement (drag terminé) → dépose sur l'emplacement survolé.
    if (d?.active) {
      const target = dragOverSlot;
      setDrag(null);
      setDragOverSlot(null);
      if (target != null && target !== d.item.slot) moveItem(d.item.itemId, target);
      return;
    }
    setDrag(null);
    setDragOverSlot(null);

    // 2) Simple tap.
    // 2a) une carte est déjà « prise » → on la pose ici (annule si re-tap sur elle).
    if (pickedItemId) {
      if (pickedItemId !== item?.itemId) moveItem(pickedItemId, slot);
      setPickedItemId(null);
      setSelectedSlot(null);
      return;
    }
    // 2b) tap sur une carte → on la « prend » pour la déplacer au tap suivant.
    if (item) {
      setPickedItemId(item.itemId);
      setSelectedSlot(null);
      return;
    }
    // 2c) tap sur un emplacement vide → sélection pour poser une carte du tiroir.
    setSelectedSlot((prev) => (prev === slot ? null : slot));
  }

  function removeItem(itemId: string) {
    if (!active || pending) return;
    const next = showcases.map((s) =>
      s.id === active.id ? { ...s, items: s.items.filter((it) => it.itemId !== itemId) } : s,
    );
    void run(next, () => removeItemAction({ showcaseId: active.id, itemId }));
  }

  // ---- Rendu -----------------------------------------------------------------

  if (!active) {
    return (
      <div className="rounded-[16px] border border-dashed border-charbon-500 bg-charbon-800/50 p-10 text-center">
        <p className="mb-4 text-[14px] text-texte-doux">{t("noBinders")}</p>
        <button
          type="button"
          onClick={createBinder}
          disabled={pending}
          className="font-display -skew-x-3 rounded-[10px] bg-carmin px-5 py-3 text-[13px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {t("newBinder")}
        </button>
      </div>
    );
  }

  const total = slotsPerPage(active.cols, active.rows);
  const safePage = Math.min(page, active.pageCount - 1);
  const bySlot = new Map(active.items.filter((it) => it.page === safePage).map((it) => [it.slot, it]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Colonne principale : classeur */}
      <div>
        {/* Onglets de classeurs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {showcases.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveId(s.id);
                setPage(0);
                setSelectedSlot(null);
                setPickedItemId(null);
              }}
              className={`font-display -skew-x-3 rounded-[10px] px-4 py-2 text-[12px] tracking-[1.5px] uppercase transition ${
                s.id === active.id
                  ? "bg-carmin text-white"
                  : "border border-charbon-500 bg-charbon-800 text-texte-doux hover:text-blanc-casse"
              }`}
            >
              {s.title || t("binderNumber", { n: i + 1 })}
            </button>
          ))}
          {showcases.length < SHOWCASE_MAX_BINDERS && (
            <button
              type="button"
              onClick={createBinder}
              disabled={pending}
              className="font-display -skew-x-3 rounded-[10px] border border-dashed border-charbon-500 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:text-blanc-casse disabled:opacity-50"
            >
              + {t("newBinder")}
            </button>
          )}
        </div>

        {/* Réglages du classeur actif */}
        <div className="mb-5 rounded-[16px] border border-charbon-500 bg-charbon-800/60 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              defaultValue={active.title ?? ""}
              key={`title-${active.id}`}
              maxLength={SHOWCASE_TITLE_MAX}
              placeholder={t("titlePlaceholder")}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (active.title ?? "")) patchConfig({ title: v || null });
              }}
              className="min-w-[160px] flex-1 rounded-[8px] border border-charbon-500 bg-charbon-900 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
            />
            <button
              type="button"
              onClick={() => deleteBinder(active.id)}
              disabled={pending}
              className="text-[12px] font-bold tracking-[1px] text-carmin uppercase transition hover:text-carmin-alt disabled:opacity-50"
            >
              {t("deleteBinder")}
            </button>
          </div>

          {/* Visibilité du classeur : public / amis / privé */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold tracking-[1px] text-texte-dim uppercase">
              {t.has("visibilityLabel") ? t("visibilityLabel") : "Visibilité"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(["PUBLIC", "FRIENDS", "PRIVATE"] as const).map((v) => {
                const on = active.visibility === v;
                const fallback = v === "PUBLIC" ? "Public" : v === "FRIENDS" ? "Amis" : "Privé";
                const key = `visibility_${v}`;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => patchConfig({ visibility: v })}
                    disabled={pending}
                    className={`rounded-[7px] px-2.5 py-1.5 text-[12px] font-bold transition disabled:opacity-50 ${
                      on
                        ? "bg-carmin text-white"
                        : "border border-charbon-500 bg-charbon-900 text-texte-doux hover:text-blanc-casse"
                    }`}
                  >
                    {t.has(key) ? t(key) : fallback}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-[1px] text-texte-dim uppercase">{t("gridSize")}</span>
              <div className="flex flex-wrap gap-1.5">
                {SHOWCASE_GRID_PRESETS.map((g) => {
                  const on = g.cols === active.cols && g.rows === active.rows;
                  return (
                    <button
                      key={`${g.cols}x${g.rows}`}
                      type="button"
                      onClick={() => patchConfig({ cols: g.cols, rows: g.rows })}
                      disabled={pending}
                      className={`rounded-[7px] px-2.5 py-1.5 text-[12px] font-bold transition disabled:opacity-50 ${
                        on ? "bg-carmin text-white" : "border border-charbon-500 bg-charbon-900 text-texte-doux hover:text-blanc-casse"
                      }`}
                    >
                      {g.cols}×{g.rows}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-[1px] text-texte-dim uppercase">{t("pages")}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patchConfig({ pageCount: Math.max(SHOWCASE_MIN_PAGES, active.pageCount - 1) })}
                  disabled={pending || active.pageCount <= SHOWCASE_MIN_PAGES}
                  className="h-7 w-7 rounded-[7px] border border-charbon-500 bg-charbon-900 text-[16px] leading-none text-texte-doux transition hover:text-blanc-casse disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-6 text-center text-[14px] font-bold text-blanc-casse">{active.pageCount}</span>
                <button
                  type="button"
                  onClick={() => patchConfig({ pageCount: Math.min(SHOWCASE_MAX_PAGES, active.pageCount + 1) })}
                  disabled={pending || active.pageCount >= SHOWCASE_MAX_PAGES}
                  className="h-7 w-7 rounded-[7px] border border-charbon-500 bg-charbon-900 text-[16px] leading-none text-texte-doux transition hover:text-blanc-casse disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-[8px] border border-carmin/40 bg-carmin/10 px-4 py-2 text-[13px] text-carmin">{error}</p>
        )}

        {/* Grille d'emplacements */}
        <p className="mb-3 text-[12px] text-texte-dim">
          {pickedItemId && t.has("moveSlotHint") ? t("moveSlotHint") : t("selectSlotHint")}
        </p>
        {/* overflow-x-auto : sur mobile un classeur large (3-4 colonnes) défile
            horizontalement au lieu d'écraser les cartes. */}
        <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-3 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${active.cols}, minmax(84px, 1fr))` }}
        >
          {Array.from({ length: total }, (_, slot) => {
            const item = bySlot.get(slot);
            const isSelected = selectedSlot === slot;
            const isPicked = !!item && pickedItemId === item.itemId;
            const isDragSource = !!item && drag?.item.itemId === item.itemId;
            const isDropTarget = drag != null && dragOverSlot === slot && !isDragSource;
            return (
              <div
                key={slot}
                data-slot={slot}
                onPointerDown={(e) => onSlotPointerDown(e, item)}
                onPointerMove={onSlotPointerMove}
                onPointerUp={(e) => onSlotPointerUp(e, slot, item)}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setDrag(null);
                  setDragOverSlot(null);
                }}
                // touch-action:none sur une carte → le geste devient un drag (pas un scroll).
                style={item ? { touchAction: "none" } : undefined}
                className={`relative rounded-xl transition-transform duration-200 ${
                  isDropTarget
                    ? "scale-[1.04] ring-2 ring-or ring-offset-2 ring-offset-charbon-900"
                    : isSelected || isPicked
                      ? "ring-2 ring-carmin ring-offset-2 ring-offset-charbon-900"
                      : ""
                }`}
              >
                {item ? (
                  <div
                    key={item.itemId}
                    className={`group animate-pop relative touch-none select-none transition-[transform,opacity] duration-200 ${
                      isDragSource
                        ? "opacity-30"
                        : isPicked
                          ? "scale-[1.04] cursor-grabbing"
                          : "cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    <ShowcaseCard card={item} />
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.itemId);
                      }}
                      title={t("removeCard")}
                      // Toujours visible au tactile (pas de survol), révélé au survol sur desktop.
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-[15px] leading-none text-white opacity-80 transition hover:bg-carmin sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    className={`flex aspect-5/7 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition ${
                      isSelected
                        ? "border-carmin bg-carmin/10"
                        : pickedItemId || drag
                          ? "border-carmin/40 bg-charbon-800/40 hover:border-carmin"
                          : "border-charbon-500/40 bg-charbon-800/40 hover:border-charbon-400"
                    }`}
                  >
                    <span className="text-[22px] text-charbon-400">+</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>

        {/* Aperçu flottant de la carte en cours de déplacement (suit le doigt / la souris) */}
        {drag && (
          <div
            className="pointer-events-none fixed z-70 w-[84px] drop-shadow-[0_18px_38px_rgba(0,0,0,0.65)]"
            style={{
              left: drag.x,
              top: drag.y,
              transform: "translate(-50%, -52%) rotate(-4deg) scale(1.06)",
            }}
          >
            <ShowcaseCard card={drag.item} />
          </div>
        )}

        {/* Navigation des pages */}
        {active.pageCount > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.max(0, p - 1));
                setSelectedSlot(null);
              }}
              disabled={safePage === 0}
              className="font-display rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition enabled:hover:text-blanc-casse disabled:opacity-40"
            >
              {t("prevPage")}
            </button>
            <span className="text-[13px] font-bold text-texte-dim">
              {t("pageOf", { page: safePage + 1, total: active.pageCount })}
            </span>
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.min(active.pageCount - 1, p + 1));
                setSelectedSlot(null);
              }}
              disabled={safePage >= active.pageCount - 1}
              className="font-display rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition enabled:hover:text-blanc-casse disabled:opacity-40"
            >
              {t("nextPage")}
            </button>
          </div>
        )}
      </div>

      {/* Colonne latérale : tiroir de cartes possédées */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-[16px] border border-charbon-500 bg-charbon-800/60 p-4">
          <h3 className="font-display mb-3 text-[15px] tracking-[1px] -skew-x-3 uppercase text-blanc-casse">{t("addCards")}</h3>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchCards")}
            className="mb-3 w-full rounded-[8px] border border-charbon-500 bg-charbon-900 px-3 py-2 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
          {placeable.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-texte-doux">{t("noCards")}</p>
          ) : (
            <div className="grid max-h-[70vh] grid-cols-3 gap-2 overflow-y-auto pr-1">
              {placeable
                .filter((c) => {
                  const q = query.trim().toLowerCase();
                  return !q || c.name.toLowerCase().includes(q) || c.numberLabel.toLowerCase().includes(q);
                })
                .map((c) => {
                  const already = placedIds.has(c.collectionItemId);
                  return (
                    <button
                      key={c.collectionItemId}
                      type="button"
                      onClick={() => placeCard(c)}
                      disabled={pending || already}
                      title={already ? t("alreadyPlaced") : c.name}
                      className={`relative block rounded-lg transition disabled:cursor-not-allowed ${
                        already ? "opacity-35" : "hover:scale-[1.03]"
                      }`}
                    >
                      <ShowcaseCard card={c} />
                      {already && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-[18px] text-or">✓</span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
