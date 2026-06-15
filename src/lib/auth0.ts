import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Lit automatiquement AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET,
// AUTH0_SECRET et APP_BASE_URL depuis l'environnement.
export const auth0 = new Auth0Client();
