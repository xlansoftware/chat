import { create } from "zustand";
import { UIMessage } from "ai";
import { AppendMessage } from "@assistant-ui/react";
import { useChat } from "@ai-sdk/react";
import { storageClient } from "@/lib/storage-client";
import { generateThreadTitle } from "@/lib/generateThreadTitle";
import { changeFileName } from "@/lib/file-name";

import { useStorageStore } from "@/store/storage-store";
import { useUsageStore } from "@/store/usage-store";
import { useModelStore } from "@/store/model-store";

type ChatLike = ReturnType<typeof useChat>;

type State = {
  messages: readonly UIMessage[];

  initialize: (chat: ChatLike) => void;
  syncAssistantMessage: (message: UIMessage) => void;
  handleCompletion: (threadId: string) => Promise<void>;

  setMessages: (messages: UIMessage[]) => void;

  onNew: (message: AppendMessage) => Promise<void>;
  onReload: (parentId: string | null, config: unknown) => Promise<void>;
  onEdit: (message: AppendMessage) => Promise<void>;
  loadThread: (threadId: string) => Promise<void>;

};

/**
 * useChatRuntimeStore
 *
 * Domain-level chat runtime store (Zustand).
 *
 * Responsibilities:
 * - Holds `messages` as the single source of truth for the UI.
 * - Encapsulates the AI transport (`useChat`) as a private dependency
 *   injected via `initialize()` and never exposed publicly.
 * - Implements chat orchestration logic:
 *   - onNew (append user + placeholder, trigger send)
 *   - onReload (slice + regenerate)
 *   - onEdit (branch + resend)
 *   - syncAssistantMessage (stream reconciliation)
 *   - handleCompletion (persistence, title recompute, side-effects)
 * - Coordinates with other domain stores (e.g. storage store) when needed.
 *
 * This store contains business rules and state transitions.
 * It is intentionally framework-agnostic and does not depend on React.
 */
export const useChatRuntimeStore = create<State>((set, get) => {
  let chat: ChatLike | null = null;

  const requireChat = () => {
    if (!chat) throw new Error("Chat not initialized");
    return chat;
  };

  return {
    messages: [],

    initialize: (chatInstance) => {
      chat = chatInstance;
    },

    setMessages: (messages: UIMessage[]) => {
      set((state) => ({ ...state, messages }));
    },

    syncAssistantMessage: (incoming) => {
      set((state) => {
        const prev = state.messages;
        const last = prev.at(-1);

        if (last?.role === "assistant") {
          return {
            messages: prev.map((m) =>
              m.id === last.id ? { ...m, parts: incoming.parts } : m
            ),
          };
        }

        return {
          messages: [
            ...prev,
            {
              id: `id${prev.length + 1}`,
              role: "assistant",
              parts: incoming.parts,
            },
          ],
        };
      });
    },

    handleCompletion: async (threadId) => {
      const c = requireChat();
      await storageClient.writeMessages(threadId, c.messages);

      const { fetchUsage } = useUsageStore.getState();
      await fetchUsage(threadId);

      // change title

      if (c.messages.length !== 2 || !threadId.endsWith("-new-chat.md")) return;

      const content = firstUserMessageText(c.messages);
      if (!content) return;

      const { updateTitle, moveNode } = useStorageStore.getState();

      const { currentModel } = useModelStore.getState();
      const title = await generateThreadTitle(content, currentModel, (title) => {
        updateTitle(threadId, title);
      });

      await storageClient.writeMetadata(threadId, { title }, true);
      const newName = changeFileName(threadId, title);
      const node = await moveNode(threadId, newName);
      console.log(`moved ${threadId} -> ${node?.name}`);

    },

    onNew: async (message) => {
      const { messages } = get();
      const c = requireChat();

      const content = (message.content[0] as { text: string }).text;

      const userMessage: UIMessage = {
        id: `id${messages.length + 1}`,
        role: "user",
        parts: [{ type: "text", text: content }],
      };

      const assistantPlaceholder: UIMessage = {
        id: `id${messages.length + 2}`,
        role: "assistant",
        parts: [
          // { type: "text", text: "Thinking..." }
        ],
      };

      const next = [...messages, userMessage, assistantPlaceholder];

      set({ messages: next });
      c.setMessages([...messages]);

      // wait awhile to test the "thinking" indicator
      // await new Promise((resolve) => setTimeout(resolve, 5000));

      await c.sendMessage(userMessage);
    },

    onReload: async (parentId, config) => {
      const { messages } = get();
      const c = requireChat();

      const sliced = sliceMessagesUntil(messages, parentId);

      set({ messages: sliced });
      c.setMessages(sliced);

      await c.regenerate({ metadata: (config as { runConfig: unknown } | null)?.runConfig });
    },

    onEdit: async (message) => {
      const { messages, onNew } = get();
      const c = requireChat();

      const sliced = sliceMessagesUntil(messages, message.parentId);

      set({ messages: sliced });
      c.setMessages(sliced);

      await onNew(message);
    },

    loadThread: async (threadId: string) => {
      const c = requireChat();

      const stored = await storageClient.readMessages(threadId);
      const { fetchUsage } = useUsageStore.getState();
      await fetchUsage(threadId);

      const stable = (stored ?? []).map((m, index) => ({
        ...m,
        id: `id${index}`,
      }));

      set({ messages: stable });

      // Keep transport in sync
      c.setMessages(stable);
    },
  };
});

const sliceMessagesUntil = <UI_MESSAGE extends UIMessage = UIMessage>(
  messages: readonly UI_MESSAGE[],
  messageId: string | null,
) => {
  if (messageId == null) return [];

  let messageIdx = messages.findIndex((m) => m.id === messageId);
  if (messageIdx === -1)
    throw new Error(
      "useVercelAIThreadState: Message not found. This is likely an internal bug in assistant-ui.",
    );

  while (messages[messageIdx + 1]?.role === "assistant") {
    messageIdx++;
  }

  return messages.slice(0, messageIdx + 1);
};

const firstUserMessageText = <UI_MESSAGE extends UIMessage = UIMessage>(
  messages: UI_MESSAGE[]
): string | null => {
  if (messages.length == 0) return null;

  const userMessage = messages.find((m) => m.role == "user");
  if (!userMessage) return null;

  const textPart = userMessage.parts.find((p) => p.type === "text");
  return textPart?.text || null;
};
