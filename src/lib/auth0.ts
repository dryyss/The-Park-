import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { getAppBaseUrl, isAuth0Configured } from "@/lib/env";

// Sync user/roles : Post-Login Action → /api/auth/roles/sync + getAuthenticatedViewer().
// Pas de Prisma ici : onCallback s'exécute dans le middleware (pas de runtime DB fiable).
export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl: getAppBaseUrl(),
  async onCallback(error, ctx) {
    if (error) {
      return NextResponse.redirect(new URL("/fr?auth_error=1", getAppBaseUrl()));
    }

    const returnTo = ctx.returnTo && ctx.returnTo.startsWith("/") ? ctx.returnTo : "/fr";
    return NextResponse.redirect(new URL(returnTo, getAppBaseUrl()));
  },
});

export { isAuth0Configured };
