import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import { getPendingFriendRequests, getFriends } from "@/server/friend/friend.service";
import { FriendButton } from "./friend-button";
import { FriendsListWithSearch } from "./friends-list-with-search";

export async function FriendRequestsPanel({ viewerId }: { viewerId: string }) {
  const t = await getTranslations("friends");
  const [requests, friends] = await Promise.all([
    getPendingFriendRequests(viewerId),
    getFriends(viewerId),
  ]);

  if (requests.length === 0 && friends.length === 0) return null;

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <section>
          <h2 className="font-display mb-3 text-[14px] tracking-[1.5px] -skew-x-3 uppercase text-blanc-casse">
            {t("pendingTitle")}
          </h2>
          <ul className="space-y-2">
            {requests.map((req) => (
              <li
                key={req.id}
                className="flex items-center gap-3 rounded-[14px] border border-charbon-500 bg-charbon-800 px-4 py-3"
              >
                <Link href={`/collectionneur/${req.slug}`}>
                  <div
                    className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[16px] text-white"
                    style={{ background: avatarGradient(req.displayName[0] ?? "A") }}
                  >
                    {req.displayName[0]?.toUpperCase()}
                  </div>
                </Link>
                <Link href={`/collectionneur/${req.slug}`} className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-blanc-casse">{req.displayName}</p>
                </Link>
                <FriendButton
                  addresseeSlug={req.slug}
                  friendshipId={req.id}
                  initialStatus="PENDING_RECEIVED"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <FriendsListWithSearch
        friends={friends}
        title={t("friendsTitle")}
        searchPlaceholder={t("searchPlaceholder")}
        noResult={t("noSearchResult")}
      />
    </div>
  );
}
