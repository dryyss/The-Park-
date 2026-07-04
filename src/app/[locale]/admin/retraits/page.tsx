import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/common/page-header";
import { AdminWithdrawalsPanel, type AdminWithdrawalRow } from "@/components/admin/admin-withdrawals-panel";

export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireModule("finance");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/retraits`)}`);
    notFound();
  }

  const requests = await prisma.withdrawalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { displayName: true, email: true } } },
  });

  const rows: AdminWithdrawalRow[] = requests.map((r) => ({
    id: r.id,
    userName: r.user.displayName,
    userEmail: r.user.email,
    amount: Number(r.amount),
    method: r.method,
    details: (r.details ?? {}) as Record<string, string>,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← Retour</Link>
      <div className="mt-4">
        <PageHeader kicker="ADMIN · FINANCE" title="Retraits vendeurs" jp="出金" />
      </div>
      <AdminWithdrawalsPanel requests={rows} />
    </main>
  );
}
