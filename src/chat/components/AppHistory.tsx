import { useStorageStore } from "@/store/storage-store";
import { useEffect } from "react";

interface PathNode {
  path: string;
  type: "file" | "folder";
}

export function AppHistory() {
  const selectedFile = useStorageStore((s) => s.selectedFile);
  const currentFolder = useStorageStore((s) => s.selectedFile ? null : s.currentFolder);
  const navigateToFolder = useStorageStore((s) => s.navigateToFolder);
  const setSelectedFile = useStorageStore((s) => s.setSelectedFile);

  // Handle browser back/forward
  useEffect(() => {
    const handler = (event: PopStateEvent) => {
      const state = event.state as PathNode | null;
      if (!state?.path) return;

      // console.log(`pop ${state.path}`);

      if (state.type === "file") {
        setSelectedFile(state.path);
      } else {
        navigateToFolder(state.path);
      }
    };

    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [navigateToFolder, setSelectedFile]);

  // Push history entry when location changes
  useEffect(() => {
    const activePath = selectedFile ?? currentFolder;
    if (!activePath) return;

    const type: PathNode["type"] = selectedFile ? "file" : "folder";

    const currentState = window.history.state as PathNode | null;

    // Avoid pushing duplicate consecutive entries
    if (
      currentState &&
      currentState.path === activePath
    ) {
      return;
    }

    // console.log(`push ${activePath}`);

    window.history.pushState(
      { path: activePath, type },
      "",
      window.location.href
    );
  }, [selectedFile, currentFolder]);

  return null;
}
