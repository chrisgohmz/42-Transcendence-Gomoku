import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { handleRealtimeChatMessage, type ChatMessage } from "./useChat";

const fetchMock = mock(async () => new Response(null, { status: 200 }));
const originalFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("handleRealtimeChatMessage", () => {
  test("appends an incoming active-conversation message and acknowledges it as read", async () => {
    const sink = createMessageSink();
    const onReadAcknowledged = mock();
    const incoming = chatMessage({ id: "msg-1", senderId: "user-bob" });

    await handleRealtimeChatMessage(incoming, {
      conversationId: "conv-1",
      currentUserId: "user-alice",
      onReadAcknowledged,
      setMessages: sink.setMessages,
    });

    expect(sink.messages).toEqual([incoming]);
    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    expect(call?.[0]).toBe("/api/conversations/conv-1/read");
    expect(call?.[1]).toMatchObject({ method: "POST" });
    expect(onReadAcknowledged).toHaveBeenCalledWith("conv-1");
  });

  test("does not acknowledge the sender socket echo as unread work", async () => {
    const sink = createMessageSink();
    const onReadAcknowledged = mock();
    const echo = chatMessage({ id: "msg-2", senderId: "user-alice" });

    await handleRealtimeChatMessage(echo, {
      conversationId: "conv-1",
      currentUserId: "user-alice",
      onReadAcknowledged,
      setMessages: sink.setMessages,
    });

    expect(sink.messages).toEqual([echo]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onReadAcknowledged).not.toHaveBeenCalled();
  });
});

function createMessageSink() {
  let messages: ChatMessage[] = [];
  const setMessages = (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    messages = typeof update === "function" ? update(messages) : update;
  };

  return {
    get messages() {
      return messages;
    },
    setMessages,
  };
}

function chatMessage({ id, senderId }: { id: string; senderId: string }): ChatMessage {
  return {
    id,
    body: "hello",
    createdAt: "2026-05-24T00:00:00.000Z",
    sender: {
      id: senderId,
      avatarUrl: null,
      displayName: senderId === "user-alice" ? "Alice" : "Bob",
      username: senderId === "user-alice" ? "alice" : "bob",
    },
  };
}
