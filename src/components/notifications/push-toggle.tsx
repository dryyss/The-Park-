"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribing" | "loading";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Active/désactive les notifications navigateur (Web Push) pour ce membre. */
export function PushToggle() {
  const t = useTranslations("push");
  const [state, setState] = useState<PushState>("loading");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "granted" : Notification.permission === "denied" ? "denied" : "default"))
      .catch(() => setState("unsupported"));
  }, [vapidKey]);

  async function enable() {
    if (!vapidKey) return;
    setState("subscribing");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "default");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "granted" : "default");
    } catch {
      setState("default");
    }
  }

  async function disable() {
    setState("subscribing");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch {
      setState("granted");
    }
  }

  if (state === "loading") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charbon-600 bg-charbon-800/50 px-4 py-3">
      <div>
        <p className="text-[13px] font-extrabold text-blanc-casse">{t("title")}</p>
        <p className="text-[11.5px] font-bold text-texte-dim">
          {state === "unsupported"
            ? t("unsupported")
            : state === "denied"
              ? t("denied")
              : state === "granted"
                ? t("enabledHint")
                : t("hint")}
        </p>
      </div>
      {state !== "unsupported" && state !== "denied" && (
        <button
          type="button"
          onClick={state === "granted" ? disable : enable}
          disabled={state === "subscribing"}
          className={[
            "rounded-lg px-4 py-2 text-[12px] font-extrabold transition disabled:opacity-50",
            state === "granted"
              ? "border border-charbon-500 text-texte-dim hover:border-neon-rouge hover:text-neon-rouge"
              : "bg-carmin text-white hover:bg-carmin-alt",
          ].join(" ")}
        >
          {state === "subscribing" ? t("working") : state === "granted" ? t("disable") : t("enable")}
        </button>
      )}
    </div>
  );
}
