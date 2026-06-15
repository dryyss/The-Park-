import "server-only";

/**
 * Client minimal pour la Management API d'Auth0 (app Machine-to-Machine).
 * Utilisé côté serveur uniquement : ne jamais importer dans un composant client.
 *
 * Cas d'usage The Park : lire/écrire les `app_metadata` (âge vérifié, statut de
 * consentement parental), gérer les rôles admin, consulter un profil en modération.
 */

const DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;
const AUDIENCE = process.env.AUTH0_M2M_AUDIENCE ?? `https://${DOMAIN}/api/v2/`;

type CachedToken = { accessToken: string; expiresAt: number };
let cache: CachedToken | null = null;

function requireConfig() {
  if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "Management API non configurée : AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID et AUTH0_M2M_CLIENT_SECRET sont requis.",
    );
  }
  return { domain: DOMAIN, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, audience: AUDIENCE };
}

async function getAccessToken(): Promise<string> {
  const { domain, clientId, clientSecret, audience } = requireConfig();

  // Réutilise le token tant qu'il reste >60s de validité.
  if (cache && cache.expiresAt - 60_000 > Date.now()) {
    return cache.accessToken;
  }

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Auth0 token error (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function mgmt<T>(path: string, init?: RequestInit): Promise<T> {
  const { domain } = requireConfig();
  const token = await getAccessToken();

  const res = await fetch(`https://${domain}/api/v2${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Management API error ${init?.method ?? "GET"} ${path} (${res.status}): ${await res.text()}`);
  }

  // Certaines réponses (DELETE / PATCH roles) sont vides.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface Auth0User {
  user_id: string;
  email?: string;
  name?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export const auth0Management = {
  getUser: (userId: string) =>
    mgmt<Auth0User>(`/users/${encodeURIComponent(userId)}`),

  /** Fusionne dans app_metadata (réservé serveur : âge vérifié, consentement…). */
  updateAppMetadata: (userId: string, appMetadata: Record<string, unknown>) =>
    mgmt<Auth0User>(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ app_metadata: appMetadata }),
    }),

  getUserRoles: (userId: string) =>
    mgmt<{ id: string; name: string }[]>(`/users/${encodeURIComponent(userId)}/roles`),

  assignRoles: (userId: string, roleIds: string[]) =>
    mgmt<void>(`/users/${encodeURIComponent(userId)}/roles`, {
      method: "POST",
      body: JSON.stringify({ roles: roleIds }),
    }),
};
