"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { io, type Socket } from "socket.io-client";

type PresenceContextType = {
  onlineUsers: string[];
};

const PresenceContext = createContext<PresenceContextType>({ onlineUsers: [] });

export function PresenceProvider({
  children,
  currentUsername
}: {
  children: ReactNode;
  currentUsername?: string;
}) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // If there is no username, they aren't logged in, so don't connect
    if (!currentUsername) return;

    const socket = io({ path: "/socket.io" });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Send the username to the server when connecting
      socket.emit("presence:subscribe", currentUsername);
    });

    socket.on("presence:update", (users: string[]) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUsername]);

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
