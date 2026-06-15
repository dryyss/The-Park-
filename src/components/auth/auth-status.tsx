"use client";

// Les routes /auth/* sont servies par le middleware Auth0, pas par des pages Next :
// on garde des <a> (navigation complète) et on désactive la règle pages.
/* eslint-disable @next/next/no-html-link-for-pages */
import { useUser } from "@auth0/nextjs-auth0";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Les routes Auth0 (/auth/*) ne sont pas localisées : on utilise des liens bruts.
export function AuthStatus() {
  const t = useTranslations("auth");
  const { user, isLoading } = useUser();

  if (isLoading) {
    return <div className="h-9 w-24 animate-pulse rounded-md bg-charbon-500/40" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-blanc-casse/70 text-sm">
          {t("greeting", { name: user.name ?? user.email ?? "" })}
        </span>
        <a href="/auth/logout">
          <Button variant="outline">{t("logout")}</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <a href="/auth/login?screen_hint=signup">
        <Button variant="outline">{t("signup")}</Button>
      </a>
      <a href="/auth/login">
        <Button>{t("login")}</Button>
      </a>
    </div>
  );
}
