import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { isOwner } from "@/server/auth/permissions.service";
import {
  listAdminPayments,
  listAdminWallets,
  getFinanceAdminStats,
} from "@/server/admin/finance-admin.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminFinancePanel } from "@/components/admin/admin-finance-panel";
import type { PaymentKind, PaymentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    paymentStatus?: string;
    paymentKind?: string;
    q?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("finance");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/finances`)}`);
    notFound();
  }

  const tab = sp.tab ?? "payments";

  const [payments, wallets, stats] = await Promise.all([
    listAdminPayments({
      status: sp.paymentStatus as PaymentStatus | undefined,
      kind: sp.paymentKind as PaymentKind | undefined,
    }),
    listAdminWallets({ q: sp.q }),
    getFinanceAdminStats(),
  ]);

  return (
    <main className="page-section">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← {t("back")}</Link>
      <div className="mt-4">
        <PageHeader kicker={t("finance.kicker")} title={t("finance.title")} jp="財務" />
      </div>
      <Link
        href="/admin/retraits"
        className="mt-4 inline-block rounded-[10px] border border-charbon-400 px-4 py-2 font-display text-[11.5px] tracking-[1px] text-texte-doux uppercase transition hover:border-carmin hover:text-carmin"
      >
        💸 Retraits vendeurs en attente
      </Link>
      <div className="mt-8">
        <AdminFinancePanel
          tab={tab}
          payments={payments}
          wallets={wallets}
          stats={stats}
          canAdjust={isOwner(access.user)}
          paymentStatus={sp.paymentStatus ?? ""}
          paymentKind={sp.paymentKind ?? ""}
          query={sp.q ?? ""}
        />
      </div>
    </main>
  );
}
