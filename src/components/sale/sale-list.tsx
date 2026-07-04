import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cardImage } from "@/lib/rarity";
import { formatPrice } from "@/lib/format";

const STATUS_COLOR: Record<string, string> = {
  PAID: "#e8b23a",
  AWAITING_SHIPMENT: "#e8b23a",
  SHIPPED: "#4fa3ff",
  DELIVERED_WINDOW: "#b05cff",
  DELIVERED: "#b05cff",
  COMPLETED: "#5ed99a",
  DISPUTED: "#ff2e63",
  NOT_SHIPPED_CANCELLED: "#ff2e63",
  CANCELLED: "#9ba3b2",
  REFUNDED: "#9ba3b2",
};

export interface SaleListEntry {
  id: string;
  status: string;
  price: number;
  shippingCost: number;
  cardName: string;
  cardImage: string | null;
  versionLabel: string;
  counterpartName: string;
  updatedAt: Date;
  trackingNumber: string | null;
  /** true = action attendue de la part du lecteur (expédier / valider…). */
  actionRequired: boolean;
}

export async function SaleList({ sales, emptyText }: { sales: SaleListEntry[]; emptyText: string }) {
  const t = await getTranslations("saleTracking");

  if (sales.length === 0) {
    return <p className="py-14 text-center text-[13.5px] font-bold text-texte-dim">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {sales.map((s) => (
        <Link
          key={s.id}
          href={`/marketplace/achat/${s.id}`}
          className="flex items-center gap-4 rounded-[16px] border border-charbon-500 bg-charbon-800 p-4 transition hover:border-carmin"
        >
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-[10px] bg-charbon-700">
            {s.cardImage && <Image src={cardImage(s.cardImage)} alt={s.cardName} fill className="object-cover" sizes="56px" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold text-blanc-casse">{s.cardName}</p>
            <p className="text-[11.5px] font-bold text-texte-dim">
              {s.versionLabel} · {s.counterpartName}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-[9.5px] font-extrabold tracking-[1px] uppercase"
                style={{ color: STATUS_COLOR[s.status] ?? "#9ba3b2", background: `${STATUS_COLOR[s.status] ?? "#9ba3b2"}18` }}
              >
                {t(`status.${s.status}`)}
              </span>
              {s.actionRequired && (
                <span className="rounded bg-carmin/15 px-2 py-0.5 text-[9.5px] font-extrabold tracking-[1px] text-carmin uppercase">
                  {t("actionRequired")}
                </span>
              )}
              {s.trackingNumber && (
                <span className="font-mono text-[10px] font-bold text-texte-faible">{s.trackingNumber}</span>
              )}
            </div>
          </div>
          <p className="font-display shrink-0 text-[17px] text-or">{formatPrice(s.price + s.shippingCost)}</p>
        </Link>
      ))}
    </div>
  );
}
