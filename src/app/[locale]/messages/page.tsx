import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getViewerConversations } from "@/server/messaging/conversation.service";
import { PageHeader } from "@/components/common/page-header";
import { ConversationList } from "@/components/messaging/conversation-sections";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("messages");

  const viewer = await requireAuthViewer(`/${locale}/messages`);
  const conversations = await getViewerConversations(viewer.id);

  return (
    <main className="mx-auto max-w-[800px] px-7 pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="メッセージ" />
      <p className="mt-3 text-[13px] font-bold text-texte-dim">{t("subtitle")}</p>
      <div className="mt-8">
        <ConversationList items={conversations} />
      </div>
    </main>
  );
}
