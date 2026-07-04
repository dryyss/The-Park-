import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireAuthViewer } from "@/server/user/user.service";
import { getUserTickets } from "@/server/support/ticket.service";
import { PageHeader } from "@/components/common/page-header";
import { TicketCreateForm } from "@/components/support/ticket-create-form";
import { Link } from "@/i18n/navigation";
import { PRIVATE_METADATA } from "@/lib/seo-messages";

export const metadata = PRIVATE_METADATA;
export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-carmin/15 text-carmin",
  PENDING: "bg-or/15 text-or",
  RESOLVED: "bg-statut-succes/15 text-statut-succes",
  CLOSED: "bg-charbon-600 text-texte-dim",
};

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("support");

  const viewer = await requireAuthViewer(`/${locale}/support`);
  const tickets = await getUserTickets(viewer.id);

  return (
    <main className="mx-auto max-w-[820px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={t("title")} jp="サポート" />
      <p className="mt-2 mb-5 text-[13px] leading-relaxed text-texte-muet">{t("intro")}</p>

      <div className="mb-6">
        <TicketCreateForm />
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charbon-500 px-4 py-8 text-center text-[13px] text-texte-muet">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-charbon-600 bg-charbon-800/50 px-4 py-3 transition hover:border-carmin"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-extrabold text-blanc-casse">{ticket.subject}</span>
                  <span className="text-[11px] font-bold text-texte-dim">
                    {t(`category.${ticket.category}`)} · {t("messageCount", { count: ticket.messageCount })}
                  </span>
                </span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${STATUS_COLORS[ticket.status] ?? ""}`}>
                  {t(`status.${ticket.status}`)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
