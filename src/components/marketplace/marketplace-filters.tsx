import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { rarityMeta } from "@/lib/rarity";
import { CONDITION_ORDER } from "@/lib/condition";
import type { MarketplaceFacets } from "@/server/marketplace/marketplace.service";

export interface MarketParams {
  intent: "sell" | "want";
  rarity?: string;
  condition?: string;
  version?: string;
  q?: string;
  country?: string;
  wishlist?: boolean;
  friends?: boolean;
}

function hrefWith(p: MarketParams, patch: Partial<MarketParams>): string {
  const merged = { ...p, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v === true) sp.set(k, "1");
    else if (typeof v === "string" && v.length > 0) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/marketplace${qs ? `?${qs}` : ""}`;
}

function Chip({
  href,
  active,
  glyph,
  glyphColor,
  children,
}: {
  href: string;
  active: boolean;
  glyph?: string;
  glyphColor?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap transition hover:-translate-y-0.5",
        active
          ? "border-carmin bg-carmin/12 text-blanc-casse"
          : "border-charbon-500 bg-charbon-800 text-texte-muet hover:text-blanc-casse",
      ].join(" ")}
    >
      {glyph && <span style={{ color: glyphColor }}>{glyph}</span>}
      {children}
    </Link>
  );
}

export async function MarketplaceFilters({
  params,
  facets,
  locale,
  isAuthenticated = false,
}: {
  params: MarketParams;
  facets: MarketplaceFacets;
  locale: string;
  isAuthenticated?: boolean;
}) {
  const t = await getTranslations("marketplace");
  const tc = await getTranslations("conditions");
  const tf = await getTranslations("friends");

  return (
    <div className="mt-6 flex flex-col gap-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
        <div className="flex flex-wrap gap-1.5">
          <Chip href={hrefWith(params, { rarity: undefined })} active={!params.rarity} glyph="☰" glyphColor="#8E8E98">
            {t("allRarities")}
          </Chip>
          {facets.rarities.map((r) => {
            const meta = rarityMeta(r.code);
            return (
              <Chip
                key={r.code}
                href={hrefWith(params, { rarity: r.code })}
                active={params.rarity === r.code}
                glyph={meta.glyph}
                glyphColor={meta.color}
              >
                {meta.label}
              </Chip>
            );
          })}
        </div>
        <form action={`/${locale}/marketplace`} className="flex min-w-0 flex-1 sm:ml-auto sm:justify-end">
          <input type="hidden" name="intent" value={params.intent} />
          {params.rarity && <input type="hidden" name="rarity" value={params.rarity} />}
          {params.condition && <input type="hidden" name="condition" value={params.condition} />}
          {params.version && <input type="hidden" name="version" value={params.version} />}
          {params.country && <input type="hidden" name="country" value={params.country} />}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchSubmit")}
            className="w-full min-w-0 rounded-full border border-charbon-500 bg-charbon-800 px-4 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin sm:max-w-[300px]"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("filterCondition")}</span>
          <Chip href={hrefWith(params, { condition: undefined })} active={!params.condition}>
            {t("allConditions")}
          </Chip>
          {CONDITION_ORDER.map((c) => (
            <Chip key={c} href={hrefWith(params, { condition: c })} active={params.condition === c}>
              {tc(c)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">{t("filterVersion")}</span>
          <Chip href={hrefWith(params, { version: undefined })} active={!params.version}>
            {t("allVersions")}
          </Chip>
          {facets.versions.map((v) => (
            <Chip key={v.code} href={hrefWith(params, { version: v.code })} active={params.version === v.code}>
              {v.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        {isAuthenticated && (
          <Chip
            href={hrefWith(params, { wishlist: params.wishlist ? undefined : true })}
            active={!!params.wishlist}
            glyph="♥"
            glyphColor="#D6004F"
          >
            {t("filterWishlist")}
          </Chip>
        )}
        {isAuthenticated && (
          <Chip
            href={hrefWith(params, { friends: params.friends ? undefined : true })}
            active={!!params.friends}
            glyph="👥"
          >
            {tf("friendsOnlyFilter")}
          </Chip>
        )}
        <form action={`/${locale}/marketplace`} className="flex items-center gap-2">
          <input type="hidden" name="intent" value={params.intent} />
          {params.rarity && <input type="hidden" name="rarity" value={params.rarity} />}
          {params.condition && <input type="hidden" name="condition" value={params.condition} />}
          {params.version && <input type="hidden" name="version" value={params.version} />}
          {params.wishlist && <input type="hidden" name="wishlist" value="1" />}
          {params.friends && <input type="hidden" name="friends" value="1" />}
          {params.q && <input type="hidden" name="q" value={params.q} />}
          <span className="text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">🌍</span>
          <input
            name="country"
            defaultValue={params.country ?? ""}
            placeholder={t("filterCountryPlaceholder")}
            aria-label={t("filterCountryPlaceholder")}
            className="w-full min-w-0 rounded-full border border-charbon-500 bg-charbon-800 px-3.5 py-1.5 text-[12px] text-blanc-casse outline-none focus:border-carmin sm:w-[160px]"
          />
        </form>
      </div>
    </div>
  );
}
