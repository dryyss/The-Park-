"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { createAuctionAction } from "@/server/auction/auction.actions";

interface OwnedVersion {
  variantId: string;
  label: string;
  availableQuantity: number;
}

const ERROR_LABELS: Record<string, string> = {
  NOT_OWNED: "Tu ne possèdes pas cet exemplaire.",
  ALL_RESERVED: "Tous tes exemplaires sont déjà réservés (en vente / enchère active).",
  VALIDATION: "Vérifie les champs saisis.",
  UNAUTHORIZED: "Connecte-toi pour créer une enchère.",
};

export function AuctionCreateButton({ versions }: { versions: OwnedVersion[] }) {
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState(versions[0]?.variantId ?? "");
  const [startPrice, setStartPrice] = useState("");
  const [durationDays, setDurationDays] = useState("3");
  const [reserve, setReserve] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (versions.length === 0) return null;

  function handleSubmit() {
    const parsed = parseFloat(startPrice.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("VALIDATION");
      return;
    }
    const parsedReserve = reserve.trim() ? parseFloat(reserve.replace(",", ".")) : undefined;
    setError(null);
    startTransition(async () => {
      const res = await createAuctionAction({
        variantId,
        startPrice: parsed,
        durationDays: parseInt(durationDays, 10),
        reservePrice: parsedReserve != null && Number.isFinite(parsedReserve) ? parsedReserve : undefined,
      });
      if (res.ok && res.auctionId) {
        router.push(`/encheres/${res.auctionId}`);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-display -skew-x-3 rounded-[10px] border-[1.5px] border-or/50 bg-or/10 px-5.5 py-3.5 text-[14px] tracking-[1.5px] text-or uppercase transition hover:bg-or/20"
      >
        ⚡ Mettre en enchère
      </button>
    );
  }

  return (
    <div className="mt-1 w-full rounded-[16px] border border-or/30 bg-charbon-800 p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[2px] text-or uppercase">⚡ Créer une enchère</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="text-[16px] text-texte-faible transition hover:text-blanc-casse"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {versions.length > 1 && (
          <div>
            <label className="mb-1 block text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
              Variante
            </label>
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="w-full rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] font-bold text-blanc-casse outline-none focus:border-or/60"
            >
              {versions.map((v) => (
                <option key={v.variantId} value={v.variantId}>
                  {v.label} — {v.availableQuantity} dispo.
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
              Prix de départ (€)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              placeholder="ex : 5,00"
              className="w-full rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] font-bold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-or/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
              Durée
            </label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="w-full rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] font-bold text-blanc-casse outline-none focus:border-or/60"
            >
              {[1, 3, 5, 7, 10, 14].map((d) => (
                <option key={d} value={d}>
                  {d} jour{d > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-extrabold tracking-[1.5px] text-texte-dim uppercase">
            Prix de réserve (optionnel, €)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
            placeholder="Laisser vide pour aucun"
            className="w-full rounded-lg border border-charbon-500 bg-charbon px-3 py-2 text-[13px] font-bold text-blanc-casse outline-none placeholder:text-texte-faible focus:border-or/60"
          />
        </div>

        {error && (
          <p className="text-[11.5px] font-extrabold text-statut-danger">
            {ERROR_LABELS[error] ?? "Une erreur est survenue, réessaie."}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="font-display -skew-x-3 rounded-lg bg-or px-5 py-3 text-[13px] tracking-[1.5px] text-charbon uppercase transition hover:opacity-85 disabled:opacity-50"
        >
          {pending ? "Création en cours…" : "Lancer l'enchère ⚡"}
        </button>
      </div>
    </div>
  );
}
