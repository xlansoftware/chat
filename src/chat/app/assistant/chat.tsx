import { useModeStore } from "@/store/mode-store";
import { Thread } from "@/components/assistant-ui/thread";
import { MarkdownEditor } from "./markdown-editor";
import { useStorageStore } from "@/store/storage-store";

// import { MyRuntimeProvider } from "./provider";
import { MyRuntimeProvider } from "../provider/provider";

export default function Chat() {

  const selectedFile = useStorageStore(({ selectedFile }) => selectedFile);
  const mode = useModeStore(({ mode }) => mode);

  if (!selectedFile) return null;

  return (
    <MyRuntimeProvider threadId={selectedFile}>
      {(mode === "chat") && <Thread />}
      {(mode === "raw") && <MarkdownEditor threadId={selectedFile} />}
    </MyRuntimeProvider>
  )
}