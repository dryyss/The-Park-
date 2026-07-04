import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAuthViewer } from "@/server/user/user.service";
import { getTicketThread } from "@/server/support/ticket.service";
import { TicketThreadView } from "@/components/support/ticket-thread-view";
import { Link } from "@/i18n/navigation";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const viewer = await requireAuthViewer(`/${locale}/support/${id}`);
  const isStaff = viewer.staffRole != null;
  const thread = await getTicketThread(id, { id: viewer.id, isStaff });
  if (!thread) notFound();

  return (
    <main className="mx-auto max-w-[720px] page-pad pt-9 pb-[60px]">
      <Link
        href={isStaff ? "/admin/support" : "/support"}
        className="mb-5 inline-block text-[12px] font-extrabold text-texte-dim transition hover:text-carmin"
      >
        ← {isStaff ? "Support admin" : "Mes tickets"}
      </Link>
      <TicketThreadView thread={thread} isStaff={isStaff} />
    </main>
  );
}
