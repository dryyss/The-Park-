import { NextResponse } from "next/server";
import { getAuthenticatedViewer } from "@/server/user/user.service";
import { getCartItemCount } from "@/server/cart/cart.service";
import { getUnreadNotificationCount } from "@/server/notification/notification.service";
import { getUnreadConversationCount } from "@/server/messaging/conversation.service";

export const dynamic = "force-dynamic";

/** État live de la top-bar pour l'utilisateur connecté (badges panier / notifs / messages). */
export async function GET() {
  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return NextResponse.json({ authenticated: false, cart: 0, notifications: 0, messages: 0 });
  }

  const [cart, notifications, messages] = await Promise.all([
    getCartItemCount(viewer.id),
    getUnreadNotificationCount(viewer.id),
    getUnreadConversationCount(viewer.id),
  ]);

  return NextResponse.json({ authenticated: true, cart, notifications, messages });
}
