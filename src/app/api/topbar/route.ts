import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { getCartItemCount } from "@/server/cart/cart.service";
import { getUnreadNotificationCount } from "@/server/notification/notification.service";
import { getUnreadConversationCount } from "@/server/messaging/conversation.service";
import { resolveStaffRole } from "@/server/auth/permissions.service";
import { getDefaultDashboardForStaffRole } from "@/server/auth/roles.definition";
import { getWalletSpendableBalanceEur } from "@/server/wallet/wallet.service";
import { getMarketplaceCartItemCount } from "@/server/marketplace-cart/marketplace-cart.service";

export const dynamic = "force-dynamic";

/** État live de la top-bar pour l'utilisateur connecté (badges panier / notifs / messages + accès staff). */
export async function GET() {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({
      authenticated: false,
      cart: 0,
      notifications: 0,
      messages: 0,
      staffRole: null,
      staffDashboardHref: null,
      walletBalanceEur: null,
      marketplaceCart: 0,
    });
  }

  const [cart, notifications, messages, walletBalanceEur, marketplaceCart] = await Promise.all([
    getCartItemCount(viewer.id),
    getUnreadNotificationCount(viewer.id),
    getUnreadConversationCount(viewer.id),
    getWalletSpendableBalanceEur(viewer.id),
    getMarketplaceCartItemCount(viewer.id),
  ]);

  const staffRole = resolveStaffRole(viewer);
  const staffDashboardHref = staffRole ? getDefaultDashboardForStaffRole(staffRole) : null;

  return NextResponse.json({
    authenticated: true,
    userId: viewer.id,
    cart,
    notifications,
    messages,
    staffRole,
    staffDashboardHref,
    walletBalanceEur,
    marketplaceCart,
  });
}
