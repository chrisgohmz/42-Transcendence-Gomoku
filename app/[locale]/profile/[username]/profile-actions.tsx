"use client";

import { UserPlus, UserMinus, UserCheck, X, MessageSquare, Loader2, Swords } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition, useEffect } from "react";

import { usePresence } from "@/components/presence-provider";
import { useChallengePlayer } from "@/hooks/useChallengePlayer";

import { processFriendAction } from "./actions";

type ProfileActionsProps = {
  targetUserId: string;
  targetUsername: string;
  initialState: "NOT_FRIENDS" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "SELF";
};

export default function ProfileActions({
  targetUserId,
  targetUsername,
  initialState,
}: ProfileActionsProps) {
  const t = useTranslations("friends");
  const profileT = useTranslations("profile.publicPage");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { socket } = usePresence();
  const { challengePlayer, challengingUsername } = useChallengePlayer();

  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      router.refresh();
    };

    socket.on("friendship:refresh", handleRefresh);

    return () => {
      socket.off("friendship:refresh", handleRefresh);
    };
  }, [socket, router]);

  if (initialState === "SELF") return null;

  const handleAction = (action: "ADD" | "ACCEPT" | "DECLINE" | "REMOVE" | "CANCEL") => {
    startTransition(async () => {
      const result = await processFriendAction(targetUserId, action);

      if (result?.success || !result?.error) {
        if (action === "ADD" || action === "ACCEPT") {
          socket?.emit("friendship:notify", targetUsername);
        }
        router.refresh();
      }
    });
  };

  const handleMessage = () => {
    router.push(`/messages?friendId=${targetUserId}`);
  };

  const isChallenging = challengingUsername === targetUsername;

  return (
    <div className="mt-6 flex w-full max-w-[220px] flex-col gap-3">
      {initialState === "NOT_FRIENDS" && (
        <button
          type="button"
          onClick={() => handleAction("ADD")}
          disabled={isPending}
          className="btn m-0 w-full px-4 py-2.5 text-sm disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus aria-hidden="true" className="h-4 w-4" />
          )}
          <span>{t("actions.add")}</span>
        </button>
      )}

      {initialState === "REQUEST_SENT" && (
        <button
          type="button"
          onClick={() => handleAction("CANCEL")}
          disabled={isPending}
          className="btn btn-subtle m-0 w-full px-4 py-2.5 text-sm disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <X aria-hidden="true" className="h-4 w-4" />
          )}
          <span>{t("actions.cancelRequest")}</span>
        </button>
      )}

      {initialState === "REQUEST_RECEIVED" && (
        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => handleAction("ACCEPT")}
            disabled={isPending}
            className="btn m-0 flex-1 px-4 py-2.5 text-sm disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck aria-hidden="true" className="h-4 w-4" />
            )}
            <span>{t("actions.accept")}</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("DECLINE")}
            disabled={isPending}
            aria-label={t("actions.decline")}
            className="btn btn-danger m-0 flex-1 px-4 py-2.5 text-sm disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <X aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {initialState === "FRIENDS" && (
        <>
          <button
            type="button"
            onClick={() => void challengePlayer(targetUsername)}
            disabled={isChallenging}
            className="btn btn-danger m-0 w-full px-4 py-2.5 text-sm font-bold disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isChallenging ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Swords aria-hidden="true" className="h-4 w-4" />
            )}
            <span>{profileT("challenge")}</span>
          </button>

          <button
            type="button"
            onClick={handleMessage}
            className="btn m-0 w-full px-4 py-2.5 text-sm"
          >
            <MessageSquare aria-hidden="true" className="h-4 w-4" />
            <span>{t("actions.chat")}</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction("REMOVE")}
            disabled={isPending}
            className="btn btn-subtle m-0 w-full px-4 py-2.5 text-sm hover:border-(--danger) hover:text-(--danger) disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <UserMinus aria-hidden="true" className="h-4 w-4" />
            )}
            <span>{t("actions.remove")}</span>
          </button>
        </>
      )}
    </div>
  );
}
