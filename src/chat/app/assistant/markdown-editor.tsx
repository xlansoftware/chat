"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

import { useTheme } from "next-themes";

type Role = "user" | "assistant" | "other";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

  const { resolvedTheme } = useTheme();

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

  const detectRoleNearDelimiter = useCallback(
    (lines: string[], startIndex: number): Role => {
      const lookahead = 12;

      for (
        let j = startIndex + 1;
        j < Math.min(lines.length, startIndex + 1 + lookahead);
        j++
      ) {
        const t = lines[j].trim();
        if (t === "---") break;

        const m = /^role:\s*(\w+)/i.exec(t);
        if (m) {
          const role = m[1].toLowerCase();
          if (role === "user") return "user";
          if (role === "assistant") return "assistant";
          return "other";
        }
      }
      return "other";
    },
    []
  );

  const applyMessageStartDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection();
    }

    const lines = model.getValue().split("\n");
    const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "--- message ---") continue;

      const lineNumber = i + 1;
      const role = detectRoleNearDelimiter(lines, i);

      const color =
        role === "user"
          ? "#3b82f6"
          : role === "assistant"
            ? "#a855f7"
            : "#f59e0b";

      const className =
        role === "user"
          ? "monaco-message-start-line monaco-message-start-user"
          : role === "assistant"
            ? "monaco-message-start-line monaco-message-start-assistant"
            : "monaco-message-start-line monaco-message-start-other";

      decorations.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className,
          minimap: { color, position: monaco.editor.MinimapPosition.Inline },
          overviewRuler: {
            color,
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      });
    }

    decorationsRef.current.set(decorations);
  }, [detectRoleNearDelimiter]);

  // Debounced scheduler (1 call per animation frame)
  const scheduleApplyDecorations = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyMessageStartDecorations();
    });
  }, [applyMessageStartDecorations]);

  // When `content` prop changes externally, schedule an update too
  useEffect(() => {
    scheduleApplyDecorations();
  }, [content, scheduleApplyDecorations]);

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

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !resolvedTheme) return;

    console.log(resolvedTheme);
    monaco.editor.setTheme(
      resolvedTheme === "dark" ? "vs-dark" : "vs"
    );
  }, [resolvedTheme]);

  if (!threadId) return <div>Select a thread</div>;

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
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
            height="100%"
            width="100%"
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;

              // reset any prior listener/collection (hot reload safety)
              contentListenerDisposeRef.current?.dispose();
              decorationsRef.current?.clear();

              decorationsRef.current = editor.createDecorationsCollection();

              // Live updates (debounced)
              contentListenerDisposeRef.current = editor.onDidChangeModelContent(() => {
                scheduleApplyDecorations();
              });

              // initial
              scheduleApplyDecorations();
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
