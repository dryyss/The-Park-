import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireModule } from "@/server/auth/admin-guard";
import { isOwner } from "@/server/auth/permissions.service";
import { listStaffMembers } from "@/server/auth/roles.service";
import { PageHeader } from "@/components/common/page-header";
import { RolesAdminPanel } from "@/components/admin/roles-panel";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const access = await requireModule("staff");
  if (!access.ok) {
    const msg = access.reason === "UNAUTHORIZED" ? t("noUser") : t("forbidden");
    return <main className="mx-auto max-w-[1320px] px-7 py-24 text-center text-texte-dim">{msg}</main>;
  }

  const members = await listStaffMembers();

  return (
    <main className="mx-auto max-w-[1320px] px-7 pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">
        ← {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader kicker={t("roles.kicker")} title={t("roles.title")} jp="役割" />
      </div>
      <div className="mt-8">
        <RolesAdminPanel members={members} isOwner={isOwner(access.user)} />
      </div>
    </main>
  );
}
