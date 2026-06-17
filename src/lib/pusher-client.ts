"use client";

import Pusher from "pusher-js";

let client: Pusher | null = null;

export function isPusherClientConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
}

/** Instance singleton Pusher (canal privé utilisateur). */
export function getPusherClient(): Pusher | null {
  if (!isPusherClientConfigured()) return null;
  if (client) return client;

  client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return client;
}

export function userChannelName(userId: string): string {
  return `private-user-${userId}`;
}
