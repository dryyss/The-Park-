import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAuthViewer } from "@/server/user/user.service";
import { getConversationThread } from "@/server/messaging/conversation.service";
import { markConversationRead } from "@/server/messaging/messaging.mutations";
import { ConversationThreadView } from "@/components/messaging/conversation-sections";

export const dynamic = "force-dynamic";

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const viewer = await requireAuthViewer(`/${locale}/messages/${id}`);
  const thread = await getConversationThread(id, viewer.id);
  if (!thread) notFound();

  await markConversationRead(viewer.id, id);

  return (
    <main className="mx-auto max-w-[900px] page-pad pt-9 pb-[60px]">
      <ConversationThreadView thread={thread} viewerId={viewer.id} />
    </main>
  );
}
