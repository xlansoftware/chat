import { storageClient } from "@/lib/storage-client";
import { useMemo, useCallback, useEffect, useState } from "react";
import { useChatRuntimeStore } from "@/app/provider/chat-runtime-store";
import { debounce } from "@/lib/debounce";

export default function useFileContent(name: string | null) {

  const [content, setConent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!name) return;

      setIsLoading(true);
      setError(null);
      try {
        setError(null);
        const content = await storageClient.readContent(name);
        setConent(content)
      } catch (e) {
        setError((e as { message: string }).message);
      } finally {
        setIsLoading(false);
      }


    })();
  }, [name, setConent, setIsLoading]);

  const updateContent = useCallback(async (content: string) => {
    if (!name) return;

    try {
      setError(null);
      await storageClient.writeContent(name, content);
      setConent(content);

      const { setMessages } = useChatRuntimeStore.getState();
      const messages = await storageClient.readMessages(name);
      setMessages(messages);
    } catch (e) {
      setError((e as { message: string }).message);
    }

  }, [name, setConent]);

  const debouncedUpdateContent = useMemo(() => {
    return debounce(updateContent, 500); // 500ms delay
  }, [updateContent]);

  // useEffect(() => {
  //   return () => {
  //     debouncedUpdateContent.cancel();
  //   };
  // }, [debouncedUpdateContent]);

  return {
    isLoading,
    content,
    error,
    updateContent: debouncedUpdateContent
  }

}