import { useStorageStore } from '@/store/storage-store';

import Chat from '@/app/assistant/chat';
import AppContentFolder from './AppContentFolder';
import { AppFileContent } from './AppFileContent';

export function AppContent() {
  // const selectedFile = useStorageStore(({ selectedFile }) => selectedFile);
  const selectedNode = useStorageStore(({ selectedFile, currentFolderContent }) => currentFolderContent.find((n) => n.name == selectedFile));

  const isChatFile = selectedNode?.name.toLowerCase().endsWith(".md");

  return (
    selectedNode?.type === "file"
      ? (isChatFile
        ? <Chat />
        : <AppFileContent path={selectedNode.name} />)
      : <AppContentFolder />
  )
}