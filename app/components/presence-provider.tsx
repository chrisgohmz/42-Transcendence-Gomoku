"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Socket } from "socket.io-client";

import { createSocket } from "@/lib/socket-client";

type PresenceContextType = {
  onlineUsers: string[];
  socket: Socket | null;
};

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: [],
  socket: null,
});

export function PresenceProvider({
  children,
  currentUsername,
  socketUrl,
}: {
  children: ReactNode;
  currentUsername?: string;
  socketUrl?: string;
}) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!currentUsername) {
      setOnlineUsers([]);
      setSocket(null);
      return;
    }

    const nextSocket = createSocket(socketUrl);

    setSocket(nextSocket);

    const handleConnect = () => {
      nextSocket.emit("presence:subscribe");
      // IMPORTANT
      nextSocket.emit("register", currentUsername);
    };

    const handlePresenceUpdate = (users: string[]) => {
      setOnlineUsers(users);
    };

    const handleUnavailable = () => {
      setOnlineUsers([]);
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("presence:update", handlePresenceUpdate);
    nextSocket.on("connect_error", handleUnavailable);
    nextSocket.on("disconnect", handleUnavailable);

    return () => {
      nextSocket.off("connect", handleConnect);
      nextSocket.off("presence:update", handlePresenceUpdate);
      nextSocket.off("connect_error", handleUnavailable);
      nextSocket.off("disconnect", handleUnavailable);
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [currentUsername, socketUrl]);

  return (
    <PresenceContext.Provider
      value={{
        onlineUsers,
        socket,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
