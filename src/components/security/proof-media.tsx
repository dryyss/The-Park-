"use client";

import { useTranslations } from "next-intl";

export function ProofVideoList({ proofs }: { proofs: { id: string; kind: string; mediaUrl: string }[] }) {
  const t = useTranslations("security.actions");
  if (proofs.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("proofsTitle")}</p>
      {proofs.map((p) => (
        <div key={p.id} className="rounded-[10px] border border-charbon-500 bg-charbon-900 p-2">
          <p className="mb-1.5 text-[10px] font-bold tracking-wide text-texte-dim uppercase">{p.kind}</p>
          <video
            src={p.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-[8px] bg-black"
            style={{ maxHeight: 260 }}
          />
        </div>
      ))}
    </div>
  );
}
