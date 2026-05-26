"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Socket } from "socket.io-client";

import { createSocket } from "@/lib/socket-client";

import { ChallengeListener } from "./challenge-listener";

type PresenceContextType = {
  onlineUsers: string[];
  setCurrentUsername: (username?: string) => void;
  socket: Socket | null;
};

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: [],
  setCurrentUsername: () => undefined,
  socket: null,
});

export function PresenceProvider({
  children,
  currentUsername,
}: {
  children: ReactNode;
  currentUsername?: string;
}) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [activeUsername, setCurrentUsername] = useState(currentUsername);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    setCurrentUsername(currentUsername);
  }, [currentUsername]);

  useEffect(() => {
    if (!activeUsername) {
      setOnlineUsers([]);
      setSocket(null);
      return;
    }

    const nextSocket = createSocket();

    setSocket(nextSocket);

    const handleConnect = () => {
      nextSocket.emit("presence:subscribe");
      nextSocket.emit("register", activeUsername);
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

    handleConnect();

    return () => {
      nextSocket.off("connect", handleConnect);
      nextSocket.off("presence:update", handlePresenceUpdate);
      nextSocket.off("connect_error", handleUnavailable);
      nextSocket.off("disconnect", handleUnavailable);
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [activeUsername]);

  return (
    <PresenceContext.Provider
      value={{
        onlineUsers,
        setCurrentUsername,
        socket,
      }}
    >
      {children}
      <ChallengeListener />
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceSessionSync({ username }: { username?: string }) {
  const { setCurrentUsername } = usePresence();

  useEffect(() => {
    setCurrentUsername(username);
  }, [setCurrentUsername, username]);

  return null;
}
