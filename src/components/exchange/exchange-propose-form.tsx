"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { proposeExchangeAction } from "@/server/exchange/exchange.actions";

type OwnedCard = { variantId: string; name: string; number: number; image: string | null; versionLabel: string };

export function ExchangeProposeForm({
  ownedCards,
  defaultRecipient = "",
}: {
  ownedCards: OwnedCard[];
  defaultRecipient?: string;
}) {
  const t = useTranslations("exchangePropose");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await proposeExchangeAction({
        recipientSlug: recipient.trim(),
        giveVariantIds: [...selected],
        message: message.trim() || undefined,
      });
      if (res.ok) {
        router.push("/echanges");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
        <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("youGive")}</h2>
        <div className="mt-4 grid max-h-[400px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          {ownedCards.map((c) => (
            <label
              key={c.variantId}
              className={`cursor-pointer rounded-[12px] border p-2 transition hover:border-carmin ${selected.has(c.variantId) ? "border-carmin bg-carmin/10" : "border-charbon-500 bg-charbon-700"}`}
            >
              <input type="checkbox" checked={selected.has(c.variantId)} onChange={() => toggle(c.variantId)} className="sr-only" />
              <div className="relative aspect-[2.5/3.5] overflow-hidden rounded-[8px] bg-charbon-600">
                {c.image && <Image src={c.image} alt={c.name} fill className="object-cover" sizes="100px" />}
              </div>
              <p className="mt-1.5 truncate text-[11px] font-extrabold text-blanc-casse">{c.name}</p>
              <p className="text-[10px] font-bold text-texte-faible">#{String(c.number).padStart(2, "0")}</p>
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("recipient")}</h2>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t("recipientPlaceholder")}
            className="mt-3 w-full rounded-lg border border-charbon-500 bg-charbon-700 px-4 py-3 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
        </div>
        <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-5">
          <h2 className="font-display text-[16px] tracking-wide text-blanc-casse uppercase">{t("message")}</h2>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t("messagePlaceholder")}
            className="mt-3 w-full resize-none rounded-lg border border-charbon-500 bg-charbon-700 px-4 py-3 text-[13px] text-blanc-casse outline-none focus:border-carmin"
          />
        </div>
        {error && <p className="text-[12px] font-bold text-neon-rouge">{t("error")}</p>}
        <button
          type="button"
          disabled={pending || selected.size === 0 || !recipient.trim()}
          onClick={handleSubmit}
          className="font-display rounded-[12px] bg-carmin py-4 text-[14px] tracking-[1.5px] text-white uppercase transition hover:bg-carmin-alt disabled:opacity-50"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
        <Link href="/echanges" className="text-center text-[12px] font-extrabold text-carmin hover:underline">
          ← {t("back")}
        </Link>
      </section>
    </div>
  );
}
