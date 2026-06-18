import "server-only";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl, isStripeConfigured } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import type { WalletConnectStatus } from "@/lib/wallet";

export type { WalletConnectStatus };

export async function getWalletConnectStatus(userId: string): Promise<WalletConnectStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeConnectAccountId: true,
      connectChargesEnabled: true,
      connectPayoutsEnabled: true,
    },
  });

  if (!user?.stripeConnectAccountId) {
    return { hasAccount: false, payoutsEnabled: false, chargesEnabled: false, detailsSubmitted: false };
  }

  return {
    hasAccount: true,
    payoutsEnabled: user.connectPayoutsEnabled,
    chargesEnabled: user.connectChargesEnabled,
    detailsSubmitted: user.connectPayoutsEnabled,
  };
}

async function ensureConnectAccountId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeConnectAccountId: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.stripeConnectAccountId) return user.stripeConnectAccountId;

  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

  const account = await getStripe().accounts.create({
    type: "express",
    country: "FR",
    email: user.email,
    capabilities: { transfers: { requested: true } },
    metadata: { userId: user.id, platform: "the-park" },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectAccountId: account.id },
  });

  return account.id;
}

export async function syncConnectAccountByStripeId(stripeAccountId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { stripeConnectAccountId: stripeAccountId },
    select: { id: true },
  });
  if (!user) return;

  const account = await getStripe().accounts.retrieve(stripeAccountId);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      connectChargesEnabled: account.charges_enabled ?? false,
      connectPayoutsEnabled: account.payouts_enabled ?? false,
    },
  });
}

export async function syncConnectAccountForUser(userId: string): Promise<WalletConnectStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });
  if (user?.stripeConnectAccountId) {
    await syncConnectAccountByStripeId(user.stripeConnectAccountId);
  }
  return getWalletConnectStatus(userId);
}

export async function createConnectOnboardingLink(userId: string, locale: string): Promise<string> {
  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

  const accountId = await ensureConnectAccountId(userId);
  const baseUrl = getAppBaseUrl();

  const link = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/${locale}/portefeuille?connect=refresh`,
    return_url: `${baseUrl}/${locale}/portefeuille?connect=success`,
    type: "account_onboarding",
  });

  if (!link.url) throw new Error("STRIPE_ACCOUNT_LINK_MISSING");
  return link.url;
}

/** Lien pour mettre à jour IBAN / infos bancaires d'un compte déjà onboardé. */
export async function createConnectUpdateLink(userId: string, locale: string): Promise<string> {
  if (!isStripeConfigured()) throw new Error("STRIPE_NOT_CONFIGURED");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeConnectAccountId: true },
  });
  if (!user?.stripeConnectAccountId) throw new Error("CONNECT_NOT_SETUP");

  const baseUrl = getAppBaseUrl();
  const link = await getStripe().accountLinks.create({
    account: user.stripeConnectAccountId,
    refresh_url: `${baseUrl}/${locale}/portefeuille?connect=refresh`,
    return_url: `${baseUrl}/${locale}/portefeuille?connect=success`,
    type: "account_update",
  });

  if (!link.url) throw new Error("STRIPE_ACCOUNT_LINK_MISSING");
  return link.url;
}
