import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FolderIcon, MessageSquare } from "lucide-react";

import { getNodeDisplayName } from "@/lib/node-display-name";
import type { Node } from '@/types/nodes';
import { useStorageStore } from "@/store/storage-store";
import { useEffect, useState } from "react";
import { storageClient } from "@/lib/storage-client";

function plural(n: number | undefined, singular: string, plural?: string): string | null {
  if (!n || n === 0) return "";
  if (n === 1) return `1 ${singular}`;
  return `${n} ${plural || singular + 's'}`;
}

export function FolderItem({ node }: { node: Node }) {

  const [summary, setSummary] = useState<{ files: number; folders: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const selectedFile = useStorageStore(({ selectedFile }) => selectedFile);
  const navigateToFolder = useStorageStore(({ navigateToFolder }) => navigateToFolder);

  const file = node;

  useEffect(() => {
    storageClient.listNodes(node.name)
      .then(({ nodes }) => {
        setSummary({
          files: (nodes || []).filter((n) => n.type === "file").length,
          folders: (nodes || []).filter((n) => n.type === "folder").length,
        });
      })
      .catch((error) => {
        console.error(`Failed to load content for ${node.name}:`, error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [node]);



  return (<Card
    key={file.name}
    className={cn(
      'gap-2',
      'cursor-pointer transition-all hover:shadow-md',
      selectedFile === file.name && 'ring-2 ring-primary',
      isLoading && 'opacity-50 pointer-events-none'
    )}
    onClick={() => navigateToFolder(file.name)}
  >
    <CardHeader className="pb-0">
      <CardTitle className="flex items-center gap-2 text-base min-w-0">
        <FolderIcon className="h-5 w-5 text-gray-500" />
        <span className="truncate">{getNodeDisplayName(file)}</span>
      </CardTitle>
      <CardDescription className="flex flex-wrap items-center gap-2">
        {(summary?.files || 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            {/* <MessageSquare className="h-3.5 w-3.5" /> */}
            {plural(summary?.files, "file")}
          </span>
        )}
        {(summary?.folders || 0) > 0 ? (
          <span className="inline-flex items-center gap-1">
            {plural(summary?.folders, "folder")}
          </span>
        ) : null}
      </CardDescription>
    </CardHeader>
    {/* <CardContent className="text-xs text-muted-foreground">
      Folder
    </CardContent> */}
  </Card>)
}