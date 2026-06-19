import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listAdminListings, getMarketplaceAdminStats } from "@/server/admin/marketplace-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminMarketplacePanel } from "@/components/admin/admin-marketplace-panel";
import type { ListingStatus, ListingType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminMarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("marketplace");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/marketplace`)}`);
    notFound();
  }

  const page = Math.max(1, Number(sp.page) || 1);
  const [result, stats] = await Promise.all([
    listAdminListings({
      q: sp.q,
      status: sp.status as ListingStatus | undefined,
      type: sp.type as ListingType | undefined,
      page,
    }),
    getMarketplaceAdminStats(),
  ]);

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("back")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("marketplace.kicker")} title={t("marketplace.title")} jp="マーケット" />
      </div>
      <div className="mt-8">
        <AdminMarketplacePanel
          result={result}
          stats={stats}
          query={sp.q ?? ""}
          status={sp.status ?? ""}
          type={sp.type ?? ""}
        />
      </div>
    </main>
  );
}
