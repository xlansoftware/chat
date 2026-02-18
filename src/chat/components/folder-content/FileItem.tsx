import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileIcon, MessageSquare } from "lucide-react";

import { getNodeDisplayName } from "@/lib/node-display-name";
import type { Node } from '@/types/nodes';
import { useStorageStore } from "@/store/storage-store";
import { useEffect, useState } from "react";
import { storageClient } from "@/lib/storage-client";
import { chatSummary } from "@/lib/summary";

function plural(n: number | undefined, singular: string, plural?: string): string | null {
  if (!n || n === 0) return "";
  if (n === 1) return `1 ${singular}`;
  return `${n} ${plural || singular + 's'}`;
}

function isChatFile(name: string) {
  return name.toLowerCase().endsWith(".md");
}

export function FileItem({ node }: { node: Node }) {
  const setSelectedFile = useStorageStore(({ setSelectedFile }) => setSelectedFile);
  const [summary, setSummary] = useState<ReturnType<typeof chatSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    storageClient.readContent(node.name)
      .then((content) => {
        const s = isChatFile(node.name)
          ? chatSummary(content)
          : null
          ;
        setSummary(s);
      })
      .catch((error) => {
        console.error(`Failed to load content for ${node.name}:`, error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [node]);

  const messageCount = summary?.userMessages.length ?? 0;
  const hasContent = summary && (messageCount > 0 || (summary?.codeCount ?? 0) > 0);

  return (
    <Card
      className={cn(
        'gap-2',
        'cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/20',
        isLoading && 'opacity-50 pointer-events-none',
      )}
      onClick={() => !isLoading && setSelectedFile(node.name)}
    >
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base min-w-0 flex-1">
          <div className="relative">
            <FileIcon className={cn(
              "h-5 w-5 transition-colors",
              hasContent ? "text-blue-500" : "text-gray-400"
            )} />
          </div>
          <span
            className="truncate font-medium"
            title={getNodeDisplayName(node)}
          >
            {getNodeDisplayName(node)}
          </span>
        </CardTitle>

        {hasContent && (
          <CardDescription className="flex flex-wrap items-center gap-2">
            {messageCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {plural(messageCount, "message")}
              </span>
            )}
            {summary?.codeCount ? (
              <span className="inline-flex items-center gap-1">
                {plural(summary.codeCount, "code block")}
              </span>
            ) : null}
          </CardDescription>
        )}
      </CardHeader>

      {hasContent ? (
        <CardContent className="text-sm text-muted-foreground pt-0">
          {summary?.firstUserMessageText && (
            <div className="relative">
              <p className="line-clamp-2 italic">
                {summary.firstUserMessageText}
              </p>
              {summary.firstAssistantMessageText && (
                <div className="border-t border-border/50">
                  <p className="line-clamp-1 text-xs opacity-75">
                    {summary.firstAssistantMessageText}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      ) : (
        null
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </Card>
  );
}