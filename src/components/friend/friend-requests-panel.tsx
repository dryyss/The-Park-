import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { avatarGradient } from "@/lib/avatars";
import { getPendingFriendRequests, getFriends } from "@/server/friend/friend.service";
import { FriendButton } from "./friend-button";
import { FriendsListWithSearch } from "./friends-list-with-search";
import { MemberSearch } from "./member-search";

export async function FriendRequestsPanel({ viewerId }: { viewerId: string }) {
  const t = await getTranslations("friends");
  const [requests, friends] = await Promise.all([
    getPendingFriendRequests(viewerId),
    getFriends(viewerId),
  ]);

  return (
    <div className="space-y-8">
      {/* Toujours visible : c'est le point d'entrée pour ajouter des rivaux. */}
      <MemberSearch />
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

      {friends.length > 0 ? (
        <FriendsListWithSearch
          friends={friends}
          title={t("friendsTitle")}
          searchPlaceholder={t("searchPlaceholder")}
          noResult={t("noSearchResult")}
        />
      ) : (
        <div className="rounded-[16px] border border-dashed border-charbon-400 bg-charbon-800/50 px-6 py-10 text-center">
          <div className="font-jp text-[30px] font-black text-charbon-500">ライバル募集</div>
          <p className="mt-2 text-[13.5px] font-bold text-texte-dim">{t("friendsEmpty")}</p>
          <p className="mt-1 text-[12px] font-bold text-texte-faible">{t("emptyHint")}</p>
        </div>
      )}
    </div>
  );
}
