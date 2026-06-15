import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { DomainResolutionError } from "@auth0/nextjs-auth0/server";
import { routing } from "@/i18n/routing";
import { auth0, isAuth0Configured } from "@/lib/auth0";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Auth0 désactivé si variables manquantes (ex. premier déploiement Vercel sans env).
  if (!isAuth0Configured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[auth0] Variables manquantes sur ce déploiement : AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET",
      );
    }
    return intlMiddleware(request);
  }

  try {
    const authRes = await auth0.middleware(request);

    if (request.nextUrl.pathname.startsWith("/auth")) {
      return authRes;
    }

    const intlRes = intlMiddleware(request);

    for (const cookie of authRes.cookies.getAll()) {
      intlRes.cookies.set(cookie);
    }

    return intlRes;
  } catch (err) {
    if (err instanceof DomainResolutionError) {
      console.error("[auth0] DomainResolutionError — vérifie AUTH0_DOMAIN sur Vercel", err.cause ?? err);
      return intlMiddleware(request);
    }
    throw err;
  }
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
