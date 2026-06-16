import { setRequestLocale } from "next-intl/server";
import { requireAuthenticatedStaff } from "@/server/auth/admin-guard";
import { resolveStaffRole } from "@/server/auth/permissions.service";
import { getDashboardsForStaffRole } from "@/server/auth/roles.definition";
import { AdminNav } from "@/components/admin/admin-nav";

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
  if (!access.ok) return children;

  const staffRole = resolveStaffRole(access.user);
  if (!staffRole) return children;

  const dashboards = getDashboardsForStaffRole(staffRole);

  return (
    <>
      <div className="mx-auto max-w-[1320px] px-7 pt-9">
        <AdminNav dashboards={dashboards} staffRole={staffRole} />
      </div>
      {children}
    </>
  );
}
