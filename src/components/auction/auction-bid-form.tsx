"use client";

import { useState, useTransition } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placeBidAction, purchaseAutoBidOptionAction } from "@/server/auction/auction.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

// Pas minimum imposé sur toute enchère : 10 centimes.
const MIN_STEP = 0.1;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function AuctionBidForm({
  auctionId,
  minAmount,
  increment = MIN_STEP,
  isAuthenticated: isAuthenticatedProp,
  autoBidUnlocked = false,
  autoBidFeeEur,
  shippingCostEur = 0,
  isTopBidder = false,
}: {
  auctionId: string;
  minAmount: number;
  increment?: number;
  isAuthenticated?: boolean;
  /** L'option payante « enchère automatique » est déjà détenue sur cette enchère. */
  autoBidUnlocked?: boolean;
  autoBidFeeEur: number;
  /** Port choisi à l'inscription : dû au même moment que l'adjudication. */
  shippingCostEur?: number;
  /** Le membre détient déjà la meilleure mise : il n'a personne à dépasser. */
  isTopBidder?: boolean;
}) {
  const t = useTranslations("auctions");
  const format = useFormatter();
  const router = useRouter();
  const { user } = useUser();
  const isAuthenticated = isAuthenticatedProp ?? !!user;
  // Jamais en dessous de 10 centimes, même si le pas de la vente est plus fin.
  const step = Math.max(MIN_STEP, increment);
  const [amount, setAmount] = useState(round2(minAmount));
  const [error, setError] = useState<string | null>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);
  // Solde insuffisant : on ouvre une modale de recharge plutôt qu'un message d'erreur sec.
  // `forOption` distingue l'achat de l'option de la mise elle-même — le manque
  // d'argent ne porte pas sur la même chose, le texte non plus.
  const [funding, setFunding] = useState<{
    balance: number;
    required: number;
    forOption?: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  // Enchère automatique : le plafond n'est saisissable qu'une fois l'option achetée.
  const [unlocked, setUnlocked] = useState(autoBidUnlocked);
  const [autoBidOn, setAutoBidOn] = useState(false);
  // Miser quand on mène déjà n'a de sens que pour relever son plafond d'enchère
  // automatique : le serveur refuse tout le reste (ALREADY_HIGHEST). On évite
  // ainsi un aller-retour dont l'issue est connue d'avance.
  const bidLocked = isTopBidder && !(unlocked && autoBidOn);
  const [maxAmount, setMaxAmount] = useState(round2(minAmount));

  // Paliers rapides : chaque clic ajoute le montant au champ (en euros).
  const quickIncrements = [1, 5, 10, 100];

  const eur = (v: number) => format.number(v, { style: "currency", currency: "EUR" });

  // Recale la saisie sur la grille du pas, sans jamais passer sous le minimum.
  function normalize(v: number): number {
    if (!Number.isFinite(v) || v < minAmount) return round2(minAmount);
    const steps = Math.round((v - minAmount) / step);
    return round2(minAmount + steps * step);
  }

  function errorMessage(code: string): string {
    switch (code) {
      case "BID_TOO_LOW":
        return t("errorBidTooLow", { amount: minAmount });
      case "SELF_BID":
        return t("errorSelfBid");
      case "ALREADY_HIGHEST":
        return t("errorAlreadyHighest");
      case "AUCTION_NOT_FOUND":
        return t("errorEnded");
      case "MAX_BELOW_BID":
        return t("errorMaxBelowBid");
      case "AUTO_BID_NOT_UNLOCKED":
        return t("errorAutoBidLocked");
      case "NOT_REGISTERED":
        return t("errorNotRegistered");
      default:
        return t("errorGeneric");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    const bid = normalize(amount);
    // Un plafond sous la mise n'a pas de sens : on le remonte plutôt que de faire
    // un aller-retour serveur pour se voir renvoyer MAX_BELOW_BID.
    const cap = autoBidOn && unlocked ? Math.max(round2(maxAmount), bid) : undefined;

    startTransition(async () => {
      setError(null);
      setShowLoginGate(false);
      setFunding(null);
      const res = await placeBidAction({ auctionId, amount: bid, maxAmount: cap });
      if (!res.ok) {
        if (res.error === "UNAUTHORIZED") setShowLoginGate(true);
        else if (res.error === "INSUFFICIENT_WALLET") {
          // Le serveur renvoie le montant engagé (plafond) ; le port s'y ajoute.
          setFunding({
            balance: res.balanceEur ?? 0,
            required: round2((res.requiredEur ?? cap ?? bid) + shippingCostEur),
          });
        } else setError(errorMessage(res.error));
      } else router.refresh();
    });
  }

  function buyAutoBidOption() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    startTransition(async () => {
      setError(null);
      setFunding(null);
      const res = await purchaseAutoBidOptionAction({ auctionId });
      if (!res.ok) {
        if (res.error === "UNAUTHORIZED") setShowLoginGate(true);
        else if (res.error === "INSUFFICIENT_WALLET") {
          setFunding({
            balance: res.balanceEur ?? 0,
            required: res.requiredEur ?? autoBidFeeEur,
            forOption: true,
          });
        } else setError(errorMessage(res.error));
        return;
      }
      setUnlocked(true);
      setAutoBidOn(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-6">
      {showLoginGate && (
        <div className="mb-3">
          <LoginGatePrompt compact messageKey="loginGateAuction" />
        </div>
      )}
      <label className="text-texte-dim text-[11px] font-extrabold tracking-wide uppercase">
        {t("yourBid")}
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAmount(round2(minAmount))}
          className={`rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold transition ${
            amount === round2(minAmount)
              ? "border-carmin bg-carmin/15 text-carmin"
              : "border-charbon-500 bg-charbon-700 text-texte-dim hover:border-carmin/60 hover:text-blanc-casse"
          }`}
        >
          {t("bidMin", { amount: eur(round2(minAmount)) })}
        </button>
        {quickIncrements.map((inc) => (
          <button
            key={inc}
            type="button"
            onClick={() => setAmount((v) => normalize((Number.isFinite(v) ? v : minAmount) + inc))}
            className="border-charbon-500 bg-charbon-700 text-texte-dim hover:border-carmin/60 hover:text-blanc-casse rounded-full border px-3.5 py-1.5 text-[12px] font-extrabold transition"
          >
            +{inc} €
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="number"
          step={step}
          min={minAmount}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          onBlur={() => setAmount((v) => normalize(v))}
          className="border-charbon-500 bg-charbon-700 font-display text-or focus:border-carmin w-[140px] min-w-0 rounded-[11px] border px-4 py-2.5 text-[18px] outline-none"
        />
        <button
          type="submit"
          disabled={pending || bidLocked}
          className="bg-carmin font-display rounded-[12px] px-6 py-3.5 text-[14px] tracking-[1.5px] text-white uppercase disabled:opacity-50"
        >
          {t("bid")}
        </button>
      </div>
      {/* Le leader en place n'a personne à dépasser : surenchérir sur soi-même ne
          ferait que gonfler le prix qu'on devra payer. Relever son propre plafond
          d'enchère automatique reste possible, et déverrouille le bouton. */}
      {isTopBidder && (
        <p className="text-or mt-2 text-[12px] font-bold">
          {bidLocked ? t("alreadyHighest") : t("alreadyHighestRaise")}
        </p>
      )}
      {error && <p className="text-neon-rouge mt-2 text-[12px] font-bold">{error}</p>}

      <div className="border-or/30 bg-charbon-800/60 mt-4 rounded-[12px] border p-3.5">
        {unlocked ? (
          <>
            <label className="text-texte-doux flex items-center gap-2.5 text-[12.5px] font-bold">
              <input
                type="checkbox"
                checked={autoBidOn}
                onChange={(e) => setAutoBidOn(e.target.checked)}
                className="accent-or"
              />
              {t("autoBidEnable")}
            </label>
            {autoBidOn && (
              <div className="mt-3">
                <label
                  htmlFor="auto-bid-max"
                  className="text-texte-dim text-[10px] font-extrabold tracking-wide uppercase"
                >
                  {t("autoBidMaxLabel")}
                </label>
                <input
                  id="auto-bid-max"
                  type="number"
                  step={step}
                  min={minAmount}
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(Number(e.target.value))}
                  onBlur={() => setMaxAmount((v) => normalize(v))}
                  className="font-display border-charbon-500 bg-charbon-700 text-or focus:border-or mt-1 w-[140px] rounded-[11px] border px-4 py-2 text-[16px] outline-none"
                />
                <p className="text-texte-faible mt-2 text-[11px] leading-relaxed font-bold">
                  {t("autoBidHint")}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-or text-[12.5px] font-extrabold">{t("autoBidTitle")}</p>
            <p className="text-texte-faible mt-1 text-[11.5px] leading-relaxed font-bold">
              {t("autoBidPitch")}
            </p>
            <button
              type="button"
              onClick={buyAutoBidOption}
              disabled={pending}
              className="font-display border-or/60 text-or hover:bg-or/10 mt-2.5 rounded-[11px] border px-4 py-2 text-[12px] tracking-[1px] uppercase transition disabled:opacity-50"
            >
              {t("autoBidUnlock", { fee: eur(autoBidFeeEur) })}
            </button>
          </>
        )}
      </div>

      <p className="text-texte-faible mt-3 text-center text-[11px] font-bold">{t("disclaimer")}</p>

      {funding && (
        <div
          className="bg-charbon/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setFunding(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bid-funding-title"
            className="border-carmin/35 bg-charbon-800 relative w-full max-w-md rounded-[16px] border p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="bid-funding-title"
              className="font-display text-blanc-casse text-[19px] tracking-[1.5px] uppercase"
            >
              {t("insufficientTitle")}
            </h2>
            <p className="text-texte-dim mt-2.5 text-[13px] leading-relaxed font-bold">
              {t(funding.forOption ? "insufficientBodyOption" : "insufficientBody", {
                required: eur(funding.required),
                balance: eur(funding.balance),
                missing: eur(round2(Math.max(0, funding.required - funding.balance))),
              })}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href="/portefeuille"
                className="bg-carmin font-display rounded-[12px] px-5 py-3 text-[13px] tracking-[1.5px] text-white uppercase"
              >
                {t("insufficientTopUp")}
              </Link>
              <button
                type="button"
                onClick={() => setFunding(null)}
                className="border-charbon-500 bg-charbon-700 font-display text-texte-dim hover:text-blanc-casse rounded-[12px] border px-5 py-3 text-[13px] tracking-[1.5px] uppercase transition"
              >
                {t("insufficientCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
