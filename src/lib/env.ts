function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** URL explicite depuis l'env (prod / Stripe). Undefined en dev local → Auth0 infère l'hôte de la requête. */
export function getAuth0AppBaseUrl(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  const explicit = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return normalizeBaseUrl(explicit);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${normalizeBaseUrl(vercelProd)}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${normalizeBaseUrl(vercelUrl)}`;

  return undefined;
}

/** URL publique de l'app (redirects Stripe, liens absolus). */
export function getAppBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return normalizeBaseUrl(explicit);

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${normalizeBaseUrl(vercelProd)}`;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${normalizeBaseUrl(vercelUrl)}`;

  return "http://localhost:3000";
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
