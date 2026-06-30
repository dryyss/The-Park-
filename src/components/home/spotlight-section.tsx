import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import type { WantedForSaleCard } from "@/server/marketplace/marketplace.service";
import type { AuctionListItem } from "@/server/auction/auction.service";

// ── Countdown inline (server-rendered approximation) ──────────────────────
function timeLeft(endsAt: Date): string {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return "Terminée";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function CardThumb({
  image,
  name,
  glyph,
  color,
}: {
  image: string | null;
  name: string;
  glyph: string;
  color: string;
}) {
  return (
    <div
      className="relative flex h-[80px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-charbon-500"
      style={{ background: `linear-gradient(135deg,#1a1a1a 0%,${color}18 100%)` }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[26px] opacity-60" style={{ color }}>{glyph}</span>
      )}
    </div>
  );
}

export async function SpotlightSection({
  wantedCards,
  endingSoonAuctions,
}: {
  wantedCards: WantedForSaleCard[];
  endingSoonAuctions: AuctionListItem[];
}) {
  const t = await getTranslations("home");

  if (wantedCards.length === 0 && endingSoonAuctions.length === 0) return null;

  return (
    <div className="mt-[60px] grid gap-[18px] lg:grid-cols-2">

      {/* Cartes vedettes */}
      {wantedCards.length > 0 && (
        <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-[20px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
                {t("spotlightTitle")}
              </h2>
              <span className="mt-0.5 block text-[11px] font-bold tracking-[2px] text-texte-faible">
                {t("spotlightJp")}
              </span>
            </div>
            <Link href="/marketplace" className="text-[11px] font-extrabold text-carmin hover:underline">
              {t("seeAllMarket")} →
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {wantedCards.map((c, i) => (
              <Link
                key={c.listingId}
                href={`/carte/${c.cardSlug}`}
                className="group flex items-center gap-4 rounded-[12px] border border-charbon-600 bg-charbon-900 px-4 py-3 transition hover:border-carmin/50 hover:bg-charbon-800"
              >
                <span
                  className="font-display w-[22px] shrink-0 text-center text-[13px] tabular-nums"
                  style={{ color: i === 0 ? "var(--color-or)" : "var(--color-texte-faible)" }}
                >
                  #{i + 1}
                </span>
                <CardThumb image={c.image} name={c.cardName} glyph={c.glyph} color={c.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-blanc-casse">{c.cardName}</div>
                  <div className="mt-0.5 text-[11px] text-texte-faible">
                    <span style={{ color: c.color }}>{c.glyph}</span>
                    {" · "}
                    <span className="text-texte-dim">{c.wantCount} recherche{c.wantCount > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[15px] font-bold text-blanc-casse">{c.lowestPrice}</div>
                  <div className="mt-0.5 text-[10px] text-texte-faible truncate">{c.sellerName}</div>
                </div>
                <span className="shrink-0 text-[14px] text-texte-faible transition group-hover:text-carmin">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Enchères imminentes */}
      {endingSoonAuctions.length > 0 && (
        <div className="rounded-[18px] border border-charbon-500 bg-charbon-800 p-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-display text-[20px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
                {t("endingSoonTitle")}
              </h2>
              <span className="mt-0.5 block text-[11px] font-bold tracking-[2px] text-texte-faible">
                {t("endingSoonJp")}
              </span>
            </div>
            <Link href="/encheres" className="text-[11px] font-extrabold text-or hover:underline">
              {t("seeAllAuctions")} →
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {endingSoonAuctions.slice(0, 3).map((a) => {
              const remaining = timeLeft(a.endsAt);
              const urgent = a.endsAt.getTime() - Date.now() < 3_600_000;
              return (
                <Link
                  key={a.id}
                  href={`/encheres/${a.id}`}
                  className="group flex items-center gap-4 rounded-[12px] border border-charbon-600 bg-charbon-900 px-4 py-3 transition hover:border-or/40 hover:bg-charbon-800"
                >
                  <CardThumb image={a.image} name={a.cardName} glyph="⚡" color="var(--color-or)" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-blanc-casse">{a.cardName}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                      <span className="text-texte-faible">{a.bidCount} offre{a.bidCount !== 1 ? "s" : ""}</span>
                      <span className="text-texte-dim">·</span>
                      <span className="text-texte-faible">{a.sellerName}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-[15px] font-bold text-blanc-casse">{a.currentPrice}</div>
                    <div
                      className="mt-0.5 text-[10px] font-extrabold"
                      style={{ color: urgent ? "var(--color-statut-danger)" : "var(--color-or)" }}
                    >
                      ⏱ {remaining}
                    </div>
                  </div>
                  <span className="shrink-0 text-[14px] text-texte-faible transition group-hover:text-or">→</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
