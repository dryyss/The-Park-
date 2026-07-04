"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { processWithdrawalAction } from "@/server/wallet/withdrawal.actions";
import { formatPrice } from "@/lib/format";

export interface AdminWithdrawalRow {
  id: string;
  userName: string;
  userEmail: string;
  amount: number;
  method: string;
  details: Record<string, string>;
  status: string;
  createdAt: string;
}

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Virement SEPA",
  PAYPAL: "PayPal",
};

export function AdminWithdrawalsPanel({ requests }: { requests: AdminWithdrawalRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function process(id: string, decision: "PAID" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const res = await processWithdrawalAction(id, decision);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  if (requests.length === 0) {
    return <p className="py-10 text-center text-[13px] font-bold text-texte-dim">Aucune demande de retrait en attente.</p>;
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error && <p className="text-[12px] font-bold text-neon-rouge">Erreur : {error}</p>}
      {requests.map((r) => (
        <div key={r.id} className="rounded-[14px] border border-charbon-500 bg-charbon-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-extrabold text-blanc-casse">
                {r.userName} <span className="text-[11px] font-bold text-texte-faible">· {r.userEmail}</span>
              </p>
              <p className="mt-0.5 text-[11.5px] font-bold text-texte-dim">
                {METHOD_LABEL[r.method] ?? r.method} · demandé le {new Date(r.createdAt).toLocaleDateString("fr-FR")}
              </p>
              <p className="mt-1 font-mono text-[11.5px] text-texte-doux">
                {r.method === "BANK_TRANSFER"
                  ? `${r.details.holder ?? ""} — ${r.details.iban ?? ""}`
                  : r.details.paypalEmail ?? ""}
              </p>
            </div>
            <p className="font-display text-[22px] text-or">{formatPrice(r.amount)}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => process(r.id, "PAID")}
              className="font-display rounded-lg bg-statut-succes px-4 py-2 text-[11.5px] tracking-[1px] text-charbon uppercase transition hover:opacity-90 disabled:opacity-50"
            >
              ✓ Versé
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => process(r.id, "REJECTED")}
              className="font-display rounded-lg border border-neon-rouge/50 px-4 py-2 text-[11.5px] tracking-[1px] text-neon-rouge uppercase transition hover:bg-neon-rouge/10 disabled:opacity-50"
            >
              Rejeter (gains restitués)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
