"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

export function AppFileContent({ path }: { path: string }) {
  const { content, updateContent, error } = useFileContent(path);

  const editorRef =
    useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  const decorationsRef = useRef<
    import("monaco-editor").editor.IEditorDecorationsCollection | null
  >(null);

  const contentListenerDisposeRef = useRef<import("monaco-editor").IDisposable | null>(
    null
  );

  // Debounce handle
  const rafRef = useRef<number | null>(null);

  const onChange = useCallback(
    (val: string | undefined) => {
      updateContent(val ?? "");
    },
    [updateContent]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      contentListenerDisposeRef.current?.dispose();
      contentListenerDisposeRef.current = null;

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      decorationsRef.current?.clear();
      decorationsRef.current = null;
    };
  }, []);

  if (!path) return <div>Select a thread</div>;

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{ ["--thread-max-width" as string]: "44rem" }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
      >
        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="w-full h-full">
          <Editor
            height="100%"
            width="100%"
            language={getLanguageFromFilename(path)}
            value={content ?? ""}
            onChange={onChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;

              // reset any prior listener/collection (hot reload safety)
              contentListenerDisposeRef.current?.dispose();
              decorationsRef.current?.clear();

              decorationsRef.current = editor.createDecorationsCollection();
            }}
            options={{
              minimap: { enabled: true, renderCharacters: false },
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

const languageMap: Record<string, string> = {
  // Programming languages
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.cs': 'csharp',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.rs': 'rust',
  '.scala': 'scala',

  // Web technologies
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.xml': 'xml',
  '.svg': 'xml',

  // Markup and documentation
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.tex': 'latex',
  '.rst': 'restructuredtext',

  // Config files
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.conf': 'ini',

  // Shell scripts
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',

  // Databases
  '.sql': 'sql',

  // Others
  '.txt': 'plaintext',
  '.log': 'plaintext',
};

function getLanguageFromFilename(filename: string): string {
  const extension = filename.substring(filename.lastIndexOf('.'));
  return languageMap[extension] || 'plaintext';
}