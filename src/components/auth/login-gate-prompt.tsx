"use client";

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

export function GuestAuthBanner({ messageKey = "loginGateDefault" }: { messageKey?: string }) {
  return (
    <div className="mt-6">
      <LoginGatePrompt messageKey={messageKey} />
    </div>
  );
}
