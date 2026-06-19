import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isStripeConfigured, isAuth0Configured, getAppBaseUrl } from "@/lib/env";

const SNAPSHOT = { ...process.env };

beforeEach(() => {
  // Repart d'un env propre pour chaque test.
  for (const k of Object.keys(process.env)) delete process.env[k];
});

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, SNAPSHOT);
});

describe("isStripeConfigured", () => {
  it("vrai uniquement si les deux clés sont présentes", () => {
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test";
    expect(isStripeConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test";
    expect(isStripeConfigured()).toBe(true);
  });
});

describe("isAuth0Configured", () => {
  it("exige les 4 variables", () => {
    process.env.AUTH0_DOMAIN = "d";
    process.env.AUTH0_CLIENT_ID = "id";
    process.env.AUTH0_CLIENT_SECRET = "secret";
    expect(isAuth0Configured()).toBe(false);
    process.env.AUTH0_SECRET = "s";
    expect(isAuth0Configured()).toBe(true);
  });
});

describe("getAppBaseUrl", () => {
  it("localhost par défaut hors Vercel/prod", () => {
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("ignore une APP_BASE_URL localhost", () => {
    process.env.APP_BASE_URL = "http://localhost:3000/";
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("utilise une APP_BASE_URL publique en prod", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_BASE_URL = "https://the-park.app/";
    expect(getAppBaseUrl()).toBe("https://the-park.app");
  });
});
