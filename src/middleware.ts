import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { auth0 } from "@/lib/auth0";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1) Auth0 gère ses propres routes (/auth/login, /auth/callback, /auth/logout…)
  //    et la rotation du cookie de session sur toutes les requêtes.
  const authRes = await auth0.middleware(request);

  // Les routes d'auth ne doivent pas être localisées : on rend la réponse Auth0 telle quelle.
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes;
  }

  // 2) Routing i18n next-intl pour le reste.
  const intlRes = intlMiddleware(request);

  // On reporte les cookies posés par Auth0 (session) sur la réponse next-intl.
  for (const cookie of authRes.cookies.getAll()) {
    intlRes.cookies.set(cookie);
  }

  return intlRes;
}

export const config = {
  // Tout sauf API, internes Next, et fichiers statiques (avec extension)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
