import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { requireAuthViewer } from "@/server/user/user.service";
import { getShowcaseEditorData } from "@/server/showcase/showcase.service";
import { ShowcaseEditor } from "@/components/showcase/showcase-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false } };

export default async function ShowroomEditorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("showcase");

  // Éditeur réservé au propriétaire du profil.
  const viewer = await requireAuthViewer(`/collectionneur/${slug}/showroom`);
  if (viewer.slug !== slug) notFound();

  const { showcases, placeable } = await getShowcaseEditorData(viewer.id);

  return (
    <main className="page-section">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-none -skew-x-3 uppercase text-blanc-casse">
            {t("editorTitle")}
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-texte-doux">
            {t("editorIntro")}
          </p>
        </div>
        <Link
          href={`/collectionneur/${slug}`}
          className="font-display -skew-x-3 rounded-[10px] border border-charbon-500 bg-charbon-800 px-4 py-2 text-[12px] tracking-[1.5px] text-texte-doux uppercase transition hover:text-blanc-casse"
        >
          {t("backToProfile")}
        </Link>
      </div>

      <ShowcaseEditor initialShowcases={showcases} placeable={placeable} />
    </main>
  );
}
