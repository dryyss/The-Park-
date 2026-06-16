function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getExplicitBaseUrl(): string | undefined {
  const explicit = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!explicit) return undefined;
  return normalizeBaseUrl(explicit);
}

/** URL Vercel injectée automatiquement (preview ou production). */
function getVercelBaseUrl(): string | undefined {
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${normalizeBaseUrl(process.env.VERCEL_URL)}`;
  }
  return undefined;
}

/**
 * URL de base pour Auth0.
 * - Dev local : undefined → le SDK infère l'hôte de la requête.
 * - Vercel preview : undefined → infère l'URL du déploiement (callbacks à enregistrer dans Auth0).
 * - Prod : APP_BASE_URL si valide, sinon domaine Vercel production.
 */
export function getAuth0AppBaseUrl(): string | undefined {
  const explicit = getExplicitBaseUrl();
  const vercel = getVercelBaseUrl();

  // Dev local hors Vercel : inférer (localhost, IP réseau…)
  if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
    return undefined;
  }

  // URL canonique explicite (jamais localhost sur Vercel/prod)
  if (explicit && !isLocalhostUrl(explicit)) {
    return explicit;
  }

  // Preview Vercel : URL unique par déploiement → inférer depuis la requête
  if (process.env.VERCEL_ENV === "preview") {
    return undefined;
  }

  if (vercel) return vercel;

  return undefined;
}

/** URL publique de l'app (redirects Stripe, liens absolus). */
export function getAppBaseUrl(): string {
  const auth0Base = getAuth0AppBaseUrl();
  if (auth0Base) return auth0Base;

  const vercel = getVercelBaseUrl();
  if (vercel) return vercel;

  const explicit = getExplicitBaseUrl();
  if (explicit && !isLocalhostUrl(explicit)) return explicit;

  return "http://localhost:3000";
}

/** Ignore APP_BASE_URL localhost pour laisser Auth0 inférer l'hôte réel de la requête. */
export function shouldAuth0InferBaseUrl(): boolean {
  if (process.env.AUTH0_FORCE_APP_BASE_URL === "1") return false;
  if (getAuth0AppBaseUrl()) return false;

  const explicit = getExplicitBaseUrl();
  if (!explicit) return true;

  return isLocalhostUrl(explicit) || Boolean(process.env.VERCEL);
}

export function isAuth0Configured(): boolean {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET &&
      process.env.AUTH0_SECRET,
  );
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
