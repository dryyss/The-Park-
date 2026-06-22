/**
 * Client minimal pour la Management API d'Auth0 (app Machine-to-Machine).
 * Utilisé côté serveur uniquement : ne jamais importer dans un composant client.
 */

const DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;
const AUDIENCE = process.env.AUTH0_M2M_AUDIENCE ?? `https://${DOMAIN}/api/v2/`;

type CachedToken = { accessToken: string; expiresAt: number };
let cache: CachedToken | null = null;

export function isAuth0ManagementConfigured(): boolean {
  return Boolean(DOMAIN && CLIENT_ID && CLIENT_SECRET);
}

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

export interface Auth0Role {
  id: string;
  name: string;
  description?: string;
}

const THE_PARK_THEME = {
  borders: {
    button_border_radius: 8,
    button_border_weight: 1,
    buttons_style: "rounded",
    input_border_radius: 8,
    input_border_weight: 1,
    inputs_style: "rounded",
    show_widget_shadow: true,
    widget_border_weight: 1,
    widget_corner_radius: 16,
  },
  colors: {
    base_focus_color: "#D6004F",
    base_hover_color: "#B5003E",
    body_text: "#C9C9C0",
    error: "#EF4444",
    header: "#F5F5F0",
    icons: "#888880",
    input_background: "#1E1E1E",
    input_border: "#3A3A3A",
    input_filled_text: "#F5F5F0",
    input_labels_placeholders: "#888880",
    links_focused_components: "#D6004F",
    primary_button: "#D6004F",
    primary_button_label: "#FFFFFF",
    secondary_button_border: "#3A3A3A",
    secondary_button_label: "#F5F5F0",
    success: "#22C55E",
    widget_background: "#161616",
    widget_border: "#2A2A2A",
  },
  fonts: {
    body_text: { bold: false, size: 87.5 },
    buttons_text: { bold: true, size: 100 },
    font_url: "",
    headers_text: { bold: true, size: 125 },
    input_labels: { bold: false, size: 87.5 },
    links: { bold: true, size: 87.5 },
    links_style: "normal",
    reference_text_size: 16,
    subtitle: { bold: false, size: 87.5 },
    title: { bold: true, size: 150 },
  },
  page_background: {
    background_color: "#0E0E0E",
    background_image_url: "",
    page_layout: "center",
  },
  widget: {
    logo_height: 52,
    logo_position: "center",
    logo_url: "https://the-park-omega.vercel.app/uploads/pasted-1781200672492-0.png",
    social_buttons_layout: "bottom",
  },
} as const;

export const auth0Management = {
  getUser: (userId: string) => mgmt<Auth0User>(`/users/${encodeURIComponent(userId)}`),

  updateAppMetadata: (userId: string, appMetadata: Record<string, unknown>) =>
    mgmt<Auth0User>(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ app_metadata: appMetadata }),
    }),

  listRoles: () => mgmt<Auth0Role[]>("/roles"),

  createRole: (payload: { name: string; description: string }) =>
    mgmt<Auth0Role>("/roles", { method: "POST", body: JSON.stringify(payload) }),

  getUserRoles: (userId: string) =>
    mgmt<{ id: string; name: string }[]>(`/users/${encodeURIComponent(userId)}/roles`),

  assignRoles: (userId: string, roleIds: string[]) =>
    mgmt<void>(`/users/${encodeURIComponent(userId)}/roles`, {
      method: "POST",
      body: JSON.stringify({ roles: roleIds }),
    }),

  removeUserRoles: (userId: string, roleIds: string[]) =>
    mgmt<void>(`/users/${encodeURIComponent(userId)}/roles`, {
      method: "DELETE",
      body: JSON.stringify({ roles: roleIds }),
    }),

  getUsersByEmail: (email: string) =>
    mgmt<Auth0User[]>(`/users-by-email?email=${encodeURIComponent(email)}`),

  createUser: (payload: {
    email: string;
    password: string;
    name: string;
    connection?: string;
    app_metadata?: Record<string, unknown>;
  }) =>
    mgmt<Auth0User>("/users", {
      method: "POST",
      body: JSON.stringify({
        connection: payload.connection ?? "Username-Password-Authentication",
        email: payload.email,
        password: payload.password,
        name: payload.name,
        email_verified: true,
        app_metadata: payload.app_metadata,
      }),
    }),

  listClientConnections: (clientId: string) =>
    mgmt<{ connections: { id: string; name: string; strategy: string }[] }>(
      `/clients/${encodeURIComponent(clientId)}/connections`,
    ),

  disableClientConnection: (connectionId: string, clientId: string) =>
    mgmt<void>(
      `/connections/${encodeURIComponent(connectionId)}/enabled_clients/${encodeURIComponent(clientId)}`,
      { method: "DELETE" },
    ),

  applyTheParkBranding: async () => {
    // 1. Set general branding (logo, colors)
    await mgmt<unknown>("/branding", {
      method: "PATCH",
      body: JSON.stringify({
        colors: { primary: "#D6004F", page_background: "#0E0E0E" },
        logo_url: THE_PARK_THEME.widget.logo_url,
      }),
    });

    // 2. Get or create Universal Login theme
    const themes = await mgmt<Array<{ themeId: string }>>("/branding/themes");
    if (themes.length > 0) {
      await mgmt<unknown>(`/branding/themes/${themes[0].themeId}`, {
        method: "PATCH",
        body: JSON.stringify(THE_PARK_THEME),
      });
    } else {
      await mgmt<unknown>("/branding/themes", {
        method: "POST",
        body: JSON.stringify(THE_PARK_THEME),
      });
    }
  },
};
