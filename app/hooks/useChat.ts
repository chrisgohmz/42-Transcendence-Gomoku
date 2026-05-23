"use client";

// useChat — a React hook that manages everything for a single conversation:
//   1. Connects to the Socket.IO server
//   2. Subscribes to real-time messages for the active conversation
//   3. Loads message history from the REST API
//   4. Provides a sendMessage function
//
// A "hook" is just a function that uses React features (useState, useEffect).
// It keeps all the chat logic in one place so the UI component stays simple.

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { createSocket } from "@/lib/socket-client";

// The shape of a single message (mirrors what the API returns)
export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string; // ISO date string
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

export function useChat(conversationId: string | null) {
  // The list of messages displayed in the chat window
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // "idle" | "loading" | "ready" | "error"
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // We store the socket in a ref (not state) because we don't want
  // a re-render every time the socket object changes internally
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // If no conversation is selected, reset everything and do nothing
    if (!conversationId) {
      setMessages([]);
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setMessages([]);
    const controller = new AbortController();
    let isCurrentConversation = true;

    // ── Step A: Load message history from the REST API ────────────────────
    // This runs once when the conversation is opened.
    // fetch() is the browser's built-in HTTP function.
    fetch(`/api/conversations/${conversationId}/messages`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load messages");
        return res.json() as Promise<{ messages: ChatMessage[] }>;
      })
      .then((data) => {
        if (!isCurrentConversation) return;
        setMessages(data.messages);
        setStatus("ready");
      })
      .catch(() => {
        if (!isCurrentConversation || controller.signal.aborted) return;
        setStatus("error");
      });

    // ── Step B: Connect to Socket.IO and subscribe to real-time messages ──
    const socket = createSocket();
    socketRef.current = socket;

    // When the socket connects, tell the server which conversation to join
    socket.on("connect", () => {
      socket.emit("chat:subscribe", { conversationId });
    });

    // When a new message arrives from the server, append it to the list
    socket.on("chat:message", (msg: ChatMessage) => {
      setMessages((prev) => appendDedup(prev, msg));
    });

    // ── Cleanup ────────────────────────────────────────────────────────────
    // This runs when:
    //   - the component unmounts (user navigates away)
    //   - conversationId changes (user clicks a different friend)
    // Without cleanup, old listeners would pile up and you'd get duplicate messages.
    return () => {
      isCurrentConversation = false;
      controller.abort();
      socket.emit("chat:unsubscribe", { conversationId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId]); // re-run this effect whenever conversationId changes

  // ── sendMessage: called when the user submits the chat form ──────────────
  async function sendMessage(text: string): Promise<void> {
    if (!conversationId || text.trim().length === 0) return;

    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    // Use the POST response as the local source of truth so the sender sees
    // their message immediately, even if the realtime publish is slow or
    // fails. The socket echo will arrive later and be deduped by id.
    const data = (await response.json()) as { message: ChatMessage };
    setMessages((prev) => appendDedup(prev, data.message));
  }

  return { messages, status, sendMessage };
}

// Append a message to the list, skipping if we already have it by id.
function appendDedup(prev: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}
