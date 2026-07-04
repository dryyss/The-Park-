import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { TicketListItem } from "@/server/support/ticket.service";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-carmin/15 text-carmin",
  PENDING: "bg-or/15 text-or",
  RESOLVED: "bg-statut-succes/15 text-statut-succes",
  CLOSED: "bg-charbon-600 text-texte-dim",
};

/** File des tickets support pour le staff (lien vers le thread partagé /support/[id]). */
export async function AdminTicketQueue({ tickets }: { tickets: TicketListItem[] }) {
  const t = await getTranslations("support");

  return (
    <section>
      <h2 className="admin-section-title mb-4">{t("queueTitle", { count: tickets.length })}</h2>
      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charbon-500 px-4 py-6 text-center text-[13px] text-texte-muet">
          {t("queueEmpty")}
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
                    {ticket.userName} · {t(`category.${ticket.category}`)} · {t("messageCount", { count: ticket.messageCount })}
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
    </section>
  );
}
