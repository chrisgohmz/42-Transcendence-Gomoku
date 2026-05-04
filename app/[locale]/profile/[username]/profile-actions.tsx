"use client";

import { UserPlus, UserMinus, UserCheck, X, MessageSquare, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processFriendAction } from "./actions";
import { usePresence } from "@/components/presence-provider";

type ProfileActionsProps = {
  targetUserId: string;
  targetUsername: string;
  initialState: "NOT_FRIENDS" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "SELF";
};

export default function ProfileActions({ targetUserId, targetUsername, initialState }: ProfileActionsProps) {
  const t = useTranslations("friends");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { socket } = usePresence();

  useEffect(() => {
    if (!socket) return;

    socket.on("friendship:refresh", () => {
      router.refresh();
    });

    return () => {
      socket.off("friendship:refresh");
    };
  }, [socket, router]);

  if (initialState === "SELF") return null;

  const handleAction = (action: "ADD" | "ACCEPT" | "DECLINE" | "REMOVE" | "CANCEL") => {
    startTransition(async () => {
      const result = await processFriendAction(targetUserId, action);

      if (result?.success) {
        socket?.emit("friendship:notify", targetUsername);
      }
    });
  };

  const handleMessage = () => {
    router.push(`/messages?user=${targetUsername}`);
  };

  return (
    <div className="mt-6 flex flex-col gap-3 w-full max-w-[200px]">
      {initialState === "NOT_FRIENDS" && (
        <button
          onClick={() => handleAction("ADD")}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4ee8c2] px-4 py-2.5 text-sm font-bold text-[#04131a] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          <span>{t("actions.add")}</span>
        </button>
      )}

      {initialState === "REQUEST_SENT" && (
        <button
          onClick={() => handleAction("CANCEL")}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          <span>{t("actions.cancelRequest")}</span>
        </button>
      )}

      {initialState === "REQUEST_RECEIVED" && (
        <div className="flex w-full gap-2">
          <button
            onClick={() => handleAction("ACCEPT")}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4ee8c2] px-4 py-2.5 text-sm font-bold text-[#04131a] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
            <span>{t("actions.accept")}</span>
          </button>
          <button
            onClick={() => handleAction("DECLINE")}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500/20 text-red-500 px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </div>
      )}

      {initialState === "FRIENDS" && (
        <>
          <button
            onClick={handleMessage}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4ee8c2] px-4 py-2.5 text-sm font-bold text-[#04131a] transition-transform hover:-translate-y-0.5"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{t("actions.chat")}</span>
          </button>
          <button
            onClick={() => handleAction("REMOVE")}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-transparent border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-400 transition-transform hover:-translate-y-0.5 hover:text-red-400 hover:border-red-400 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            <span>{t("actions.remove")}</span>
          </button>
        </>
      )}
    </div>
  );
}
