import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getUserNotifications } from "@/server/notification/notification.service";
import { PageHeader } from "@/components/common/page-header";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("notifications");

  const viewer = await requireAuthViewer(`/${locale}/notifications`);
  const items = await getUserNotifications(viewer.id);

  return (
    <main className="mx-auto max-w-[880px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="通知" />
      <div className="mt-8">
        <NotificationFeed items={items} />
      </div>
    </main>
  );
}
