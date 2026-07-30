import { setRequestLocale } from "next-intl/server";
import { requireAuthenticatedStaff, handleAdminAccessFailure } from "@/server/auth/admin-guard";
import { resolveStaffRole } from "@/server/auth/permissions.service";
import { getDashboardsForStaffRole } from "@/server/auth/roles.definition";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  robots: { index: false, follow: false },
};

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
    handleAdminAccessFailure(locale, access.reason);
  }

  const staffRole = resolveStaffRole(access.user);
  if (!staffRole) handleAdminAccessFailure(locale, "FORBIDDEN");

  const dashboards = getDashboardsForStaffRole(staffRole);

  return (
    <AdminShell
      dashboards={dashboards}
      staffRole={staffRole}
      displayName={access.user.displayName}
    >
      {/* La console respire aussi sur les très grands écrans (cf. --page-max côté vitrine). */}
      <div className="mx-auto max-w-[1200px] 2xl:max-w-[1440px] 3xl:max-w-[1760px] 4xl:max-w-[2160px]">{children}</div>
    </AdminShell>
  );
}
