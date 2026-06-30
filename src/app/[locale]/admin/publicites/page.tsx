import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireModule } from "@/server/auth/admin-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/common/page-header";
import { AdminBannersPanel } from "@/components/admin/admin-banners-panel";
import { getAdminImageUploadMode } from "@/lib/admin-image-storage";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const access = await requireModule("content");
  if (!access.ok) {
    if (access.reason === "UNAUTHORIZED") redirect(`/auth/login?returnTo=${encodeURIComponent(`/${locale}/admin/publicites`)}`);
    notFound();
  }

  const banners = await prisma.promoBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <Link href="/admin" className="text-[12px] font-extrabold text-carmin hover:underline">← Retour</Link>
      <div className="mt-4">
        <PageHeader kicker="ADMIN" title="Bannières publicitaires" jp="広告" />
      </div>
      <div className="mt-8">
        <AdminBannersPanel banners={banners} uploadMode={getAdminImageUploadMode()} />
      </div>
    </main>
  );
}
