import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { getAppBaseUrl, getAuth0AppBaseUrl, isAuth0Configured, shouldAuth0InferBaseUrl } from "@/lib/env";

// Le SDK lit aussi process.env.APP_BASE_URL : on retire localhost sur Vercel pour inférer l'URL réelle.
const savedAppBaseUrl = process.env.APP_BASE_URL;
const auth0AppBaseUrl = getAuth0AppBaseUrl();

if (shouldAuth0InferBaseUrl() && savedAppBaseUrl) {
  delete process.env.APP_BASE_URL;
}

// Sync user/roles : Post-Login Action (claims) + getAuthenticatedViewer() (Prisma + Management API).
export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  ...(auth0AppBaseUrl ? { appBaseUrl: auth0AppBaseUrl } : {}),
  async onCallback(error, ctx) {
    const base = ctx.appBaseUrl ?? getAppBaseUrl();

    if (error) {
      const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
      console.error("[auth0] callback error", code, error);
      const url = new URL("/fr", base);
      url.searchParams.set("auth_error", code);
      return NextResponse.redirect(url);
    }

    const returnTo = ctx.returnTo && ctx.returnTo.startsWith("/") ? ctx.returnTo : "/fr";
    return NextResponse.redirect(new URL(returnTo, base));
  },
});

if (shouldAuth0InferBaseUrl() && savedAppBaseUrl) {
  process.env.APP_BASE_URL = savedAppBaseUrl;
}

export { isAuth0Configured };
