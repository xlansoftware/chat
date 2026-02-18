"use client";

import useFileContent from "@/hooks/use-file-content";

export function RawEditor({ threadId }: { threadId: string }) {

  const {
    content,
    updateContent,
    isLoading,
    error,
  } = useFileContent(threadId);

  if (!threadId) {
    return <div>Select a thread</div>;
  }

  if (isLoading) {
    return <div>Loading raw content…</div>;
  }

  return (
    <div className="flex flex-col gap-2 h-full p-4">
      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}

      <textarea
        className="min-h-[300px] w-full rounded-md border p-2 h-full"
        value={content || ""}
        onChange={(e) => updateContent(e.target.value)}
      />
    </div>
  );
}
