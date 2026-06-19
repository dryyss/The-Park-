"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { sendMessageAction } from "@/server/messaging/messaging.actions";
import { MAX_MESSAGE_PHOTOS } from "@/lib/message-photos.constants";

export function MessageComposeForm({ conversationId }: { conversationId: string }) {
  const t = useTranslations("messages");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mapError(code: string) {
    if (code === "FILE_TOO_LARGE") return t("photoErrorSize");
    if (code === "INVALID_TYPE") return t("photoErrorType");
    if (code === "TOO_MANY_ATTACHMENTS") return t("photoErrorMax", { max: MAX_MESSAGE_PHOTOS });
    if (code === "EMPTY_MESSAGE") return t("sendErrorEmpty");
    return t("sendError");
  }

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const next = [...photos];
    const nextPreviews = [...previews];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_MESSAGE_PHOTOS) break;
      next.push(file);
      nextPreviews.push(URL.createObjectURL(file));
    }
    setPhotos(next);
    setPreviews(nextPreviews);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(previews[index] ?? "");
    setPhotos((p) => p.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);

      if (photos.length > 0) {
        const fd = new FormData();
        fd.set("conversationId", conversationId);
        fd.set("body", body);
        for (const file of photos) fd.append("photos", file);

        const res = await fetch("/api/messages/send", { method: "POST", body: fd });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(mapError(data.error ?? "UNKNOWN"));
          return;
        }
      } else {
        const res = await sendMessageAction({ conversationId, body });
        if (!res.ok) {
          setError(mapError(res.error));
          return;
        }
      }

      setBody("");
      previews.forEach((u) => URL.revokeObjectURL(u));
      setPhotos([]);
      setPreviews([]);
      if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
        router.refresh();
      }
    });
  }

  const canSend = body.trim().length > 0 || photos.length > 0;

  return (
    <form onSubmit={submit} className="border-t border-charbon-500 p-4">
      {error && <p className="mb-2 text-[12px] font-bold text-neon-rouge">{error}</p>}

      {previews.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-charbon-500">
              <Image src={src} alt="" fill sizes="64px" className="object-cover" unoptimized />
              <button
                type="button"
                aria-label={t("photoRemove")}
                onClick={() => removePhoto(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={pending || photos.length >= MAX_MESSAGE_PHOTOS}
          onClick={() => fileRef.current?.click()}
          title={t("attachPhoto")}
          aria-label={t("attachPhoto")}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] border border-charbon-500 bg-charbon-700 text-[18px] text-texte-doux transition hover:border-carmin hover:text-carmin disabled:opacity-50"
        >
          📷
        </button>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("inputPlaceholder")}
          maxLength={2000}
          className="flex-1 rounded-[11px] border border-charbon-500 bg-charbon-700 px-4 py-2.5 text-[13px] text-blanc-casse outline-none focus:border-carmin"
        />
        <button
          type="submit"
          disabled={pending || !canSend}
          className="rounded-[11px] bg-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-white uppercase disabled:opacity-50"
        >
          {t("send")}
        </button>
      </div>
    </form>
  );
}
