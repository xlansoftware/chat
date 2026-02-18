import { FileIcon, Folder } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { getNodeDisplayName } from "@/lib/node-display-name";
import { useStorageStore } from "@/store/storage-store";
import { useEffect, useState } from "react";
import { storageClient } from "@/lib/storage-client";
import type { Node } from '@/types/nodes';
import { FolderItem } from "./folder-content/FolderItem";
import { FileItem } from "./folder-content/FileItem";

export default function AppContentFolder() {

  const [state, setState] = useState<{ isLoading: boolean; nodes: Node[], breadcrumbs: Node[] }>({
    isLoading: true,
    nodes: [],
    breadcrumbs: []
  })

  const {
    currentFolder,
    selectedFile,
    setSelectedFile,
  } = useStorageStore();

  const handleSelectNode = async (nodePath: string) => {
    setSelectedFile(nodePath);
  };

  useEffect(() => {
    storageClient.listNodes(selectedFile || currentFolder || "/").then(({ nodes, breadcrumbs }) => {
      setState({ isLoading: false, nodes, breadcrumbs });
    });
  }, [selectedFile, currentFolder]);

  const folders = state.nodes.filter((node) => node.type === 'folder');
  const files = state.nodes.filter((node) => node.type === 'file');

  const currentFolderNode = state.breadcrumbs?.at(-1);

  const isLoading = state.isLoading;

  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Folder className="h-6 w-6" />
            {selectedFile === '/' ? 'Home' : getNodeDisplayName(currentFolderNode)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {folders.length} {folders.length === 1 ? 'folder' : 'folders'}, {files.length} {files.length === 1 ? 'file' : 'files'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>Loading...</p>
          </div>
        ) : state.nodes.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>This folder is empty</p>
          </div>
        ) : (
          <div className="space-y-6">
            {folders.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Folders
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {folders.map((folder) =>
                    <FolderItem key={folder.name} node={folder} />
                  )}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  Files
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {files.map((file) => (
                    <FileItem key={file.name} node={file} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );

}