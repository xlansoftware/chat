"use client";

import { useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { useChatRuntimeStore } from "./chat-runtime-store";
import { useModelStore } from "@/store/model-store";

/**
 * useChatRuntimeBridge
 *
 * React-layer bridge between the AI SDK (`useChat`) and the chat runtime store.
 *
 * Responsibilities:
 * - Instantiates and owns the `useChat` transport (LLM communication).
 * - Injects the chat instance into the Zustand chat store (kept private there).
 * - Mirrors streaming updates from `chat.messages` into the store’s `messages`
 *   so the store remains the single source of truth.
 * - Detects assistant completion events (e.g., `state === "done"`) and
 *   triggers post-processing such as persistence or title recomputation.
 *
 * This hook isolates React reactivity from domain logic:
 * - The store contains orchestration and business rules.
 * - The SDK handles transport.
 * - This hook synchronizes both worlds deterministically.
 */
export function useChatRuntimeBridge(threadId: string | null) {
  const chat = useChat({
    transport: new AssistantChatTransport({
      api: "/api/chat",
      body: () => {
        return {
          modelName: useModelStore.getState().currentModel,
          threadId,
        }
      }
    }),
    messages: [],
  });

  const loadThread = useChatRuntimeStore((s) => s.loadThread);

  const initialize = useChatRuntimeStore((s) => s.initialize);
  const syncAssistantMessage = useChatRuntimeStore(
    (s) => s.syncAssistantMessage
  );
  const handleCompletion = useChatRuntimeStore(
    (s) => s.handleCompletion
  );

  // 🔹 Inject chat into store once
  useEffect(() => {
    initialize(chat);
  }, [chat, initialize]);

  useEffect(() => {
    if (!threadId) {
      useChatRuntimeStore.setState({ messages: [] });
      return;
    }

    loadThread(threadId);
  }, [threadId, loadThread]);

  // 🔹 Bridge: mirror streaming updates → store
  useEffect(() => {
    const last = chat.messages.at(-1);
    if (!last) return;
    if (last.role !== "assistant") return;

    syncAssistantMessage(last);

    const lastPart = last.parts.at(-1) as
      | { state?: string }
      | undefined;

    if (lastPart?.state === "done" && threadId) {
      handleCompletion(threadId);
    }
  }, [chat.messages, syncAssistantMessage, handleCompletion, threadId]);

  return chat;
}
