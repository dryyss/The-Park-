import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { getAppBaseUrl, getAuth0AppBaseUrl, isAuth0Configured } from "@/lib/env";

// Le SDK lit aussi process.env.APP_BASE_URL : en dev on l'ignore pour inférer l'hôte réel
// (localhost vs 127.0.0.1 vs IP réseau). Définir AUTH0_FORCE_APP_BASE_URL=1 pour forcer l'env.
const savedAppBaseUrl = process.env.APP_BASE_URL;
const forceAppBaseUrl = process.env.AUTH0_FORCE_APP_BASE_URL === "1";
const auth0AppBaseUrl = getAuth0AppBaseUrl();

if (process.env.NODE_ENV !== "production" && savedAppBaseUrl && !forceAppBaseUrl && !auth0AppBaseUrl) {
  delete process.env.APP_BASE_URL;
}

// Sync user/roles : Post-Login Action (claims) + getAuthenticatedViewer() (Prisma + Management API).
// Pas de Prisma ici : onCallback s'exécute dans le middleware (pas de runtime DB fiable).
export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  ...(auth0AppBaseUrl ? { appBaseUrl: auth0AppBaseUrl } : {}),
  async onCallback(error, ctx) {
    const base = ctx.appBaseUrl ?? getAppBaseUrl();

    if (error) {
      console.error("[auth0] callback error", error);
      return NextResponse.redirect(new URL("/fr?auth_error=1", base));
    }

    const returnTo = ctx.returnTo && ctx.returnTo.startsWith("/") ? ctx.returnTo : "/fr";
    return NextResponse.redirect(new URL(returnTo, base));
  },
});

if (process.env.NODE_ENV !== "production" && savedAppBaseUrl && !forceAppBaseUrl) {
  process.env.APP_BASE_URL = savedAppBaseUrl;
}

export { isAuth0Configured };
