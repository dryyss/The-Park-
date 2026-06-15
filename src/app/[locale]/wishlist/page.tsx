import { setRequestLocale, getTranslations } from "next-intl/server";
import { getViewerUser } from "@/server/user/user.service";
import { getViewerWishlist } from "@/server/wishlist/wishlist.service";
import { PageHeader } from "@/components/common/page-header";
import { WishlistGridClient } from "@/components/wishlist/wishlist-grid-client";

export const dynamic = "force-dynamic";

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("wishlist");

  const viewer = await getViewerUser();
  if (!viewer) {
    return <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{t("noUser")}</main>;
  }

  const items = await getViewerWishlist(viewer.id);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="ウィッシュ" />
      <div className="mt-8">
        <WishlistGridClient items={items} />
      </div>
    </main>
  );
}
