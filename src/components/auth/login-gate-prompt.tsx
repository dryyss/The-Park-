"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

export function LoginGatePrompt({
  compact = false,
  messageKey = "loginGateDefault",
  namespace = "auth",
}: {
  compact?: boolean;
  messageKey?: string;
  namespace?: string;
}) {
  const t = useTranslations(namespace);
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const returnTo = encodeURIComponent(pathname || "/");
  const loginHref = `/auth/login?returnTo=${returnTo}`;
  const signupHref = `/auth/login?screen_hint=signup&returnTo=${returnTo}`;

  return (
    <div
      className={[
        "rounded-lg border border-carmin/35 bg-carmin/10",
        compact ? "px-2.5 py-2" : "px-3.5 py-3",
      ].join(" ")}
      role="status"
    >
      <p className={`font-bold text-blanc-casse ${compact ? "text-[10px] leading-snug" : "text-[12px]"}`}>
        {t(messageKey)}
      </p>
      <div className={`mt-2 flex flex-wrap gap-2 ${compact ? "gap-1.5" : ""}`}>
        <a
          href={loginHref}
          className={`font-display rounded-md bg-carmin text-white uppercase transition hover:bg-carmin-alt ${
            compact ? "px-2.5 py-1 text-[9px] tracking-wide" : "px-3.5 py-1.5 text-[10px] tracking-[1px]"
          }`}
        >
          {tAuth("login")}
        </a>
        <a
          href={signupHref}
          className={`font-display rounded-md border border-charbon-400 text-blanc-casse uppercase transition hover:border-carmin hover:text-carmin ${
            compact ? "px-2.5 py-1 text-[9px] tracking-wide" : "px-3.5 py-1.5 text-[10px] tracking-[1px]"
          }`}
        >
          {tAuth("signup")}
        </a>
      </div>
    </div>
  );
}

export function LoginGateModal({
  open,
  onClose,
  messageKey = "loginGateDefault",
  namespace = "auth",
}: {
  open: boolean;
  onClose: () => void;
  messageKey?: string;
  namespace?: string;
}) {
  const tAuth = useTranslations("auth");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charbon/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-gate-modal-title"
        className="relative w-full max-w-md rounded-[16px] border border-carmin/35 bg-charbon-800 p-5 pr-12 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-md text-texte-dim transition hover:bg-charbon-700 hover:text-blanc-casse"
          aria-label={tAuth("loginGateDismiss")}
        >
          <span aria-hidden className="text-[18px] leading-none">
            ×
          </span>
        </button>
        <div id="login-gate-modal-title">
          <LoginGatePrompt messageKey={messageKey} namespace={namespace} />
        </div>
      </div>
    </div>
  );
}

export function GuestAuthBanner({ messageKey = "loginGateDefault" }: { messageKey?: string }) {
  const [open, setOpen] = useState(true);

  return <LoginGateModal open={open} onClose={() => setOpen(false)} messageKey={messageKey} />;
}
