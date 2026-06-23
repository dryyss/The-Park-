"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { GuestAuthBanner } from "@/components/auth/login-gate-prompt";
import { LogoutLink } from "@/components/auth/logout-link";

const MAX_AUTO_REFRESH = 2;

export function ProfileGuestOrRecovery({
  guestLinks,
}: {
  guestLinks: { href: string; label: string }[];
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!user || refreshCount >= MAX_AUTO_REFRESH) return;
    const timer = setTimeout(() => {
      setRefreshCount((c) => c + 1);
      router.refresh();
    }, 600);
    return () => clearTimeout(timer);
  }, [user, refreshCount, router]);

  if (isLoading) {
    return (
      <main className="page-section">
        <p className="text-[14px] font-bold text-texte-dim">{t("sessionLoading")}</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="page-section">
        <div className="rounded-[16px] border border-charbon-500 bg-charbon-800 p-6">
          <p className="text-[14px] font-bold text-blanc-casse">{t("sessionPending")}</p>
          <p className="mt-2 text-[13px] font-semibold text-texte-dim">{t("sessionHint")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="font-display rounded-[10px] bg-carmin px-4 py-2.5 text-[12px] tracking-[1px] text-white uppercase transition hover:bg-carmin-alt"
            >
              {t("sessionRetry")}
            </button>
            <LogoutLink label={t("sessionRelogin")} variant="nav" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-section">
      <div className="font-display text-[clamp(32px,4vw,48px)] leading-tight -skew-x-3 uppercase text-blanc-casse [text-shadow:3px_3px_0_var(--color-carmin)]">
        {t("guestTitle")}
      </div>
      <p className="mt-3 max-w-[560px] text-[14px] font-semibold text-texte-dim">{t("guestDesc")}</p>
      <GuestAuthBanner messageKey="loginGateProfile" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {guestLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-charbon-500 bg-charbon-800 p-4 text-center transition hover:border-carmin"
          >
            <span className="text-[13px] font-extrabold text-blanc-casse">{l.label}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
