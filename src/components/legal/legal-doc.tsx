import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { Link } from "@/i18n/navigation";
import { LEGAL_JP, type LegalSection, type LegalSlug } from "@/data/legal-docs";

function sectionId(slug: LegalSlug, index: number) {
  return `${slug}-${index + 1}`;
}

export async function LegalDoc({ slug }: { slug: LegalSlug }) {
  const t = await getTranslations("legal");
  const base = `docs.${slug}`;

  const title = t(`${base}.title`);
  const intro = t(`${base}.intro`);
  const sections = t.raw(`${base}.sections`) as LegalSection[];

  return (
    <main className="mx-auto max-w-[820px] page-pad pt-9 pb-[60px]">
      <PageHeader kicker={t("kicker")} title={title} jp={LEGAL_JP[slug]} />

      <p className="mt-6 text-[12px] font-bold text-texte-faible">
        {t("updatedLabel")} · {t("updatedDate")}
      </p>

      <p className="mt-4 text-[14px] leading-relaxed font-semibold text-texte-dim">{intro}</p>

      {/* Sommaire */}
      <nav className="mt-8 rounded-[14px] border border-charbon-500 bg-charbon-800 px-5 py-4">
        <div className="mb-3 text-[10.5px] font-extrabold tracking-[2px] text-texte-dim uppercase">
          {t("tocLabel")}
        </div>
        <ol className="flex flex-col gap-2">
          {sections.map((s, i) => (
            <li key={i}>
              <a
                href={`#${sectionId(slug, i)}`}
                className="text-[13px] font-bold text-[#a9a9b2] transition hover:text-carmin"
              >
                <span className="text-carmin">{i + 1}.</span> {s.h}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Corps */}
      <div className="mt-10 flex flex-col gap-9">
        {sections.map((s, i) => (
          <section key={i} id={sectionId(slug, i)} className="scroll-mt-24">
            <h2 className="font-display mb-4 text-[19px] tracking-wide text-blanc-casse uppercase">
              <span className="mr-2 text-carmin">{i + 1}.</span>
              {s.h}
            </h2>
            <div className="flex flex-col gap-3">
              {s.p?.map((para, j) => (
                <p key={`p-${j}`} className="text-[13.5px] leading-relaxed font-medium text-texte-dim">
                  {para}
                </p>
              ))}
              {s.list && s.list.length > 0 && (
                <ul className="flex flex-col gap-2 pl-1">
                  {s.list.map((item, j) => (
                    <li
                      key={`l-${j}`}
                      className="flex gap-2.5 text-[13.5px] leading-relaxed font-medium text-texte-dim"
                    >
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-carmin" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-charbon-600 pt-6">
        <Link href="/aide" className="text-[13px] font-extrabold text-carmin transition hover:text-carmin-alt">
          ← {t("backToHelp")}
        </Link>
      </div>
    </main>
  );
}
