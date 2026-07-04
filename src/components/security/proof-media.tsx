"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import { recordProofAction } from "@/server/c2c/c2c.actions";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ProofVideoList({ proofs }: { proofs: { id: string; kind: string; mediaUrl: string }[] }) {
  const t = useTranslations("security.actions");
  if (proofs.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-[10px] font-extrabold tracking-[2px] text-texte-faible uppercase">{t("proofsTitle")}</p>
      {proofs.map((p) => (
        <div key={p.id} className="rounded-[10px] border border-charbon-500 bg-charbon-900 p-2">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-texte-dim">{p.kind}</p>
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

export function VideoUploader({
  shipmentId,
  proofKind,
  onDone,
}: {
  shipmentId: string;
  proofKind: "PRESENTATION" | "UNBOXING";
  onDone: () => void;
}) {
  const t = useTranslations("security.actions");
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file) return;
    setError(null);
    setProgress(0);

    startTransition(async () => {
      try {
        // 1. Upload vers Vercel Blob via la route API C2C
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/c2c/upload-proof",
          clientPayload: JSON.stringify({ shipmentId }),
          onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
        });

        // 2. Hash du contenu pour intégrité (sha256 de l'URL blob)
        const hash = await sha256Hex(blob.url);

        // 3. Enregistre la preuve en DB
        const res = await recordProofAction({
          shipmentId,
          kind: proofKind,
          mediaUrl: blob.url,
          mediaHash: hash,
          durationSec: 30,
        });

        if (!res.ok) {
          setError(res.error ?? "UNKNOWN");
          return;
        }

        setProgress(100);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
        className="rounded-[11px] border border-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-carmin uppercase disabled:opacity-50"
      >
        {pending ? `${t("uploading")} ${progress}%` : t("recordProof")}
      </button>
      {pending && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-charbon-500">
          <div
            className="h-full rounded-full bg-carmin transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p className="text-[10px] font-bold text-texte-faible">{t("proofHint")}</p>
      {error && <p className="text-[11px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
