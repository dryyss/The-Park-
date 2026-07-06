"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import { recordProofAction } from "@/server/c2c/c2c.actions";
import { todayDropToken } from "@/lib/drop-token";

type ProofKind = "PRESENTATION" | "UNBOXING";
type Phase = "intro" | "arming" | "ready" | "recording" | "recorded" | "uploading" | "done" | "denied" | "unsupported";

const MIN_DURATION_SEC = 3;
const MAX_DURATION_SEC = 180;

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

function isCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

export function GuidedVideoCapture({
  shipmentId,
  proofKind,
  token,
  onDone,
}: {
  shipmentId: string;
  proofKind: ProofKind;
  token?: string | null;
  onDone: () => void;
}) {
  const t = useTranslations("security.capture");
  const dropToken = token || todayDropToken();
  const steps = useMemo(
    () => (t.raw(proofKind === "UNBOXING" ? "unboxingSteps" : "presentationSteps") as string[]) ?? [],
    [t, proofKind],
  );

  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const stepIndexRef = useRef(0);
  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  const cleanupStream = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!isCaptureSupported()) setPhase("unsupported");
    return () => {
      cleanupStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boucle de compositing : caméra + incrustation jeton/horodatage sur le canvas.
  const drawLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth) {
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Bandeau bas : jeton du jour + horodatage local + étape.
      const barH = Math.max(38, canvas.height * 0.09);
      ctx.fillStyle = "rgba(10,12,13,0.62)";
      ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
      const fs = Math.max(14, canvas.height * 0.032);
      ctx.font = `700 ${fs}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#E8B23A";
      ctx.fillText(`${dropToken}`, 14, canvas.height - barH / 2);
      ctx.fillStyle = "#f5f2ea";
      ctx.textAlign = "right";
      ctx.fillText(new Date().toLocaleString(), canvas.width - 14, canvas.height - barH / 2);
      ctx.textAlign = "left";
      const label = steps[stepIndexRef.current];
      if (label) {
        ctx.fillStyle = "#ff2e63";
        ctx.fillText(`● ${label.slice(0, 42)}`, 14, barH / 2 + 4);
      }
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }, [dropToken, steps]);

  async function arm() {
    setError(null);
    setPhase("arming");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      rafRef.current = requestAnimationFrame(drawLoop);
      setPhase("ready");
    } catch {
      setPhase("denied");
    }
  }

  function startRecording() {
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!canvas || !stream) return;
    const canvasStream = canvas.captureStream(30);
    stream.getAudioTracks().forEach((tr) => canvasStream.addTrack(tr));

    chunksRef.current = [];
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(canvasStream, { mimeType });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setPhase("recorded");
    };
    recorderRef.current = rec;
    startRef.current = Date.now();
    setElapsed(0);
    setStepIndex(0);
    rec.start(1000);
    setPhase("recording");

    const tick = () => {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(s);
      if (s >= MAX_DURATION_SEC) stopRecording();
    };
    const id = window.setInterval(tick, 500);
    (rec as unknown as { _timer?: number })._timer = id;
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    const id = (rec as unknown as { _timer?: number })._timer;
    if (id) window.clearInterval(id);
    if (rec.state !== "inactive") rec.stop();
  }

  function retake() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    blobRef.current = null;
    setPhase("ready");
  }

  async function submit() {
    const blob = blobRef.current;
    if (!blob) return;
    const durationSec = Math.max(MIN_DURATION_SEC, elapsed);
    setPhase("uploading");
    setProgress(0);
    try {
      const hash = await sha256Hex(blob);
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const blobRes = await upload(`proof-${proofKind.toLowerCase()}-${Date.now()}.${ext}`, blob, {
        access: "public",
        handleUploadUrl: "/api/c2c/upload-proof",
        clientPayload: JSON.stringify({ shipmentId }),
        onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
      });

      const res = await recordProofAction({
        shipmentId,
        kind: proofKind,
        mediaUrl: blobRes.url,
        mediaHash: hash,
        durationSec,
        tokenShown: dropToken,
      });
      if (!res.ok) {
        setError(res.error ?? "UNKNOWN");
        setPhase("recorded");
        return;
      }
      cleanupStream();
      setPhase("done");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
      setPhase("recorded");
    }
  }

  // Repli fichier si capture non supportée (navigateur ancien / desktop sans caméra).
  if (phase === "unsupported") {
    return <FileFallback shipmentId={shipmentId} proofKind={proofKind} dropToken={dropToken} onDone={onDone} />;
  }

  return (
    <div className="mt-4 rounded-2xl border border-charbon-600 bg-charbon-900/60 p-4">
      <video ref={videoRef} className="hidden" playsInline muted />

      {phase === "intro" && (
        <div>
          <p className="text-[12px] font-bold text-texte-muet">{t(proofKind === "UNBOXING" ? "introUnboxing" : "introPresentation")}</p>
          <ol className="mt-3 flex flex-col gap-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[12px] font-bold text-texte-doux">
                <span className="text-carmin">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] font-bold text-texte-faible">
            {t("tokenNotice")} <span className="font-mono text-or">{dropToken}</span>
          </p>
          <button
            type="button"
            onClick={arm}
            className="font-display mt-4 rounded-lg bg-carmin px-5 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
          >
            {t("enableCamera")}
          </button>
        </div>
      )}

      {phase === "denied" && (
        <div>
          <p className="text-[12px] font-bold text-neon-rouge">{t("cameraDenied")}</p>
          <FileFallback shipmentId={shipmentId} proofKind={proofKind} dropToken={dropToken} onDone={onDone} />
        </div>
      )}

      {(phase === "arming" || phase === "ready" || phase === "recording") && (
        <div>
          <div className="relative overflow-hidden rounded-xl bg-black">
            <canvas ref={canvasRef} className="w-full" style={{ maxHeight: 420 }} />
            {phase === "recording" && (
              <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-extrabold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-neon-rouge" />
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
              </span>
            )}
          </div>

          {phase === "recording" && steps.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold text-blanc-casse">
                {t("stepOf", { n: stepIndex + 1, total: steps.length })} — {steps[stepIndex]}
              </p>
              {stepIndex < steps.length - 1 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))}
                  className="shrink-0 rounded-lg border border-charbon-500 px-3 py-1.5 text-[11px] font-extrabold text-texte-doux hover:border-carmin"
                >
                  {t("nextStep")}
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            {phase === "ready" && (
              <button
                type="button"
                onClick={startRecording}
                className="font-display rounded-lg bg-carmin px-5 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
              >
                {t("startRecording")}
              </button>
            )}
            {phase === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                disabled={elapsed < MIN_DURATION_SEC}
                className="font-display rounded-lg border border-neon-rouge px-5 py-2.5 text-[12px] tracking-[1px] text-neon-rouge uppercase transition hover:bg-neon-rouge/10 disabled:opacity-40"
              >
                {elapsed < MIN_DURATION_SEC ? t("recordMin", { s: MIN_DURATION_SEC }) : t("stopRecording")}
              </button>
            )}
            {phase === "arming" && <p className="text-[12px] font-bold text-texte-dim">{t("startingCamera")}</p>}
          </div>
        </div>
      )}

      {(phase === "recorded" || phase === "uploading" || phase === "done") && recordedUrl && (
        <div>
          <video ref={previewRef} src={recordedUrl} controls playsInline className="w-full rounded-xl bg-black" style={{ maxHeight: 420 }} />
          <p className="mt-2 text-[11px] font-bold text-texte-faible">
            {t("recordedInfo", { s: Math.max(MIN_DURATION_SEC, elapsed) })} · <span className="font-mono text-or">{dropToken}</span>
          </p>
          {phase === "uploading" ? (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-charbon-500">
                <div className="h-full rounded-full bg-carmin transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-[11px] font-bold text-texte-dim">{t("uploading")} {progress}%</p>
            </div>
          ) : phase === "done" ? (
            <p className="mt-3 text-[12px] font-extrabold text-statut-succes">{t("saved")}</p>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={submit}
                className="font-display rounded-lg bg-carmin px-5 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
              >
                {t("submitProof")}
              </button>
              <button
                type="button"
                onClick={retake}
                className="rounded-lg border border-charbon-500 px-4 py-2.5 text-[12px] font-bold text-texte-dim hover:border-charbon-400"
              >
                {t("retake")}
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}

/** Repli : import d'un fichier vidéo (hash du contenu réel + jeton transmis). */
function FileFallback({
  shipmentId,
  proofKind,
  dropToken,
  onDone,
}: {
  shipmentId: string;
  proofKind: ProofKind;
  dropToken: string;
  onDone: () => void;
}) {
  const t = useTranslations("security.capture");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const hash = await sha256Hex(file);
      const blobRes = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/c2c/upload-proof",
        clientPayload: JSON.stringify({ shipmentId }),
        onUploadProgress: (e) => setProgress(Math.round(e.percentage)),
      });
      const res = await recordProofAction({
        shipmentId,
        kind: proofKind,
        mediaUrl: blobRes.url,
        mediaHash: hash,
        durationSec: 30,
        tokenShown: dropToken,
      });
      if (!res.ok) {
        setError(res.error ?? "UNKNOWN");
        return;
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "UPLOAD_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-carmin px-5 py-2.5 font-display text-[12px] tracking-wide text-carmin uppercase disabled:opacity-50"
      >
        {busy ? `${t("uploading")} ${progress}%` : t("importFile")}
      </button>
      <p className="mt-1.5 text-[10.5px] font-bold text-texte-faible">{t("fallbackHint")}</p>
      {error && <p className="mt-2 text-[11px] font-bold text-neon-rouge">{error}</p>}
    </div>
  );
}
