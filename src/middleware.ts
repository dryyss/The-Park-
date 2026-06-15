import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Tout sauf API, internes Next, et fichiers statiques (avec extension)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
