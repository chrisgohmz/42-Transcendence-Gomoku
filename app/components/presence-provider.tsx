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

    nextSocket.on("connect", () => {
      nextSocket.emit("presence:subscribe");

      // IMPORTANT
      nextSocket.emit("register", currentUsername);
    });

    nextSocket.on("presence:update", (users: string[]) => {
      setOnlineUsers(users);
    });

    nextSocket.on("connect_error", () => {
      setOnlineUsers([]);
    });

    return () => {
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