"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useTranslations } from "next-intl";

type UploadScope = "catalog" | "shop";

function mapUploadError(t: ReturnType<typeof useTranslations>, code: string): string {
  if (code === "FILE_TOO_LARGE") return t("uploadErrorSize");
  if (code === "INVALID_TYPE") return t("uploadErrorType");
  if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return t("uploadErrorForbidden");
  if (code === "STORAGE_NOT_CONFIGURED" || code === "WRITE_FAILED") return t("uploadErrorStorage");
  return t("uploadError");
}

export function AdminImageDropzone({
  scope,
  onUploaded,
  disabled,
  compact,
}: {
  scope: UploadScope;
  onUploaded: (fileName: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("admin.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    if (disabled || pending) return;
    setError(null);

    const fd = new FormData();
    fd.set("scope", scope);
    fd.set("file", file);

    startTransition(async () => {
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: boolean; error?: string; fileName?: string };
      if (!res.ok || !data.ok || !data.fileName) {
        setError(mapUploadError(t, data.error ?? "UNKNOWN"));
        return;
      }
      onUploaded(data.fileName);
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div
        role="button"
        tabIndex={disabled || pending ? -1 : 0}
        aria-disabled={disabled || pending}
        aria-label={t("dropzoneLabel")}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !pending) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled && !pending) inputRef.current?.click();
        }}
        className={`rounded-lg border border-dashed px-3 text-center transition ${
          compact ? "py-2.5" : "py-4"
        } ${
          dragOver
            ? "border-carmin bg-carmin/10"
            : "border-charbon-400 bg-charbon-900/40 hover:border-or/50 hover:bg-or/5"
        } ${disabled || pending ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
        <p className={`font-extrabold text-blanc-casse ${compact ? "text-[11px]" : "text-[12px]"}`}>
          {pending ? t("uploadPending") : t("dropzoneLabel")}
        </p>
        {!pending && (
          <p className={`mt-0.5 text-texte-faible ${compact ? "text-[10px]" : "text-[11px]"}`}>
            {t("dropzoneHint")} · {t("dropzoneBrowse")}
          </p>
        )}
      </div>
      {error && <p className="text-[11px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
