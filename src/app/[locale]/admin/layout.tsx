import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireAuthenticatedStaff } from "@/server/auth/admin-guard";
import { resolveStaffRole } from "@/server/auth/permissions.service";
import { getDashboardsForStaffRole } from "@/server/auth/roles.definition";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireAuthenticatedStaff();
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") {
      redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin`)}`);
    }
    notFound();
  }

  const staffRole = resolveStaffRole(access.user);
  if (!staffRole) notFound();

  const dashboards = getDashboardsForStaffRole(staffRole);

  return (
    <AdminShell
      dashboards={dashboards}
      staffRole={staffRole}
      displayName={access.user.displayName}
    >
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </AdminShell>
  );
}
