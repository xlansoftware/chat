"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { convertUIMessageToThreadMessage } from "./message-converter";
import { useChatRuntimeStore } from "./chat-runtime-store";
import { useChatRuntimeBridge } from "./use-chat-runtime-bridge";

export function MyRuntimeProvider({
  children,
  threadId,
}: {
  children: React.ReactNode;
  threadId: string | null;
}) {
  useChatRuntimeBridge(threadId);

  const { messages, onNew, onReload, onEdit } =
    useChatRuntimeStore();

  const runtime = useExternalStoreRuntime({
    messages,
    setMessages: (messages) =>
      useChatRuntimeStore.setState({ messages }),
    onNew,
    onReload,
    onEdit,
    convertMessage: convertUIMessageToThreadMessage,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
