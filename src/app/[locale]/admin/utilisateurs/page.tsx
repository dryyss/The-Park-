import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { listUsers } from "@/server/admin/users.service";
import { PageHeader } from "@/components/common/page-header";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import type { AccountStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_VALUES = ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "BANNED", "DELETED"];

export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("users");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/utilisateurs`)}`);
    notFound();
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const status = sp.status && STATUS_VALUES.includes(sp.status) ? (sp.status as AccountStatus) : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const result = await listUsers({ q, status, page });

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("users.kicker")} title={t("users.title")} jp="会員" />
      </div>
      <div className="mt-8">
        <AdminUsersPanel result={result} query={q} status={status ?? ""} />
      </div>
    </main>
  );
}
