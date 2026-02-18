---
usage:
  totalUsage:
    inputTokens: 8524
    inputTokenDetails:
      noCacheTokens: 76
      cacheReadTokens: 8448
    outputTokens: 1448
    outputTokenDetails:
      textTokens: 1448
      reasoningTokens: 0
    totalTokens: 9972
    reasoningTokens: 0
    cachedInputTokens: 8448
  tokensPerSecond: 90.73
  updatedAt: 1770820459222
title: Monaco minimap
---
--- message ---
role: user
---
I am developing a react app using the Monaco editor:

```ts
        <div className="w-full h-full">
          <Editor
            height="100%"
            width="100%"
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            options={{
              minimap: { enabled: true }, // this is the "side map"
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
```

do I have control over the minimap? can I highlight something with code?

--- message ---
role: assistant
---
Yes—Monaco gives you **some** control over the minimap, but it’s mostly **configuration** (size/position/rendering). It’s **not** designed to be a second “overlay canvas” that you directly draw/highlight on independently. If you want to “highlight something with code”, the supported way is to add **decorations** (or markers) to the editor; those can also show up in the minimap depending on options.

## 1) What you can control on the minimap

Via editor options (`minimap: {...}`) you can change things like:

```ts
options={{
  minimap: {
    enabled: true,
    side: "right",          // or "left"
    size: "proportional",   // or "fit" | "fill"
    showSlider: "mouseover",// or "always"
    renderCharacters: false, // often nicer for markdown
    maxColumn: 120,
    scale: 1,               // zoom factor (number)
  },
}}
```

Those are the typical knobs. There isn’t an official API like “highlight this range in the minimap only”.

## 2) Highlighting with code (supported approach): decorations

Monaco’s highlighting is done with **decorations** added to the model. Decorations can:
- highlight a range in the main editor
- optionally show a colored stripe in the **overview ruler** (right-side scrollbar area)
- optionally show in the **minimap** (depending on minimap settings and decoration options)

Example (plain Monaco API):

```ts
// assuming you have access to `editor` instance
const model = editor.getModel();
if (!model) return;

const decorationIds = editor.deltaDecorations([], [
  {
    range: new monaco.Range(3, 1, 3, 20), // line 3, col 1 -> col 20
    options: {
      inlineClassName: "myInlineHighlight",  // CSS class for in-text highlight
      minimap: {
        color: "#ffcc00", // highlight color in minimap
        position: monaco.editor.MinimapPosition.Inline,
      },
      overviewRuler: {
        color: "#ffcc00",
        position: monaco.editor.OverviewRulerLane.Right,
      },
    },
  },
]);
```

CSS:

```css
.myInlineHighlight {
  background: rgba(255, 204, 0, 0.35);
}
```

Important notes:
- You need the `editor` instance (from `@monaco-editor/react`, you usually get it via `onMount`).
- Keep the returned `decorationIds` if you want to update/remove highlights later (call `deltaDecorations(oldIds, newDecorations)`).

## 3) If you’re using `@monaco-editor/react`: how to get the editor instance

```tsx
import Editor from "@monaco-editor/react";

function MyEditor({ content, onChange }) {
  const handleMount = (editor, monaco) => {
    // store editor/monaco in refs so you can call deltaDecorations later
  };

  return (
    <Editor
      height="100%"
      width="100%"
      language="markdown"
      value={content ?? ""}
      onChange={onChange}
      onMount={handleMount}
      options={{
        minimap: { enabled: true },
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}
```

## 4) Alternative “highlighting”: markers (errors/warnings)

If your “highlight” is semantic (linting, validation), use **markers** (`monaco.editor.setModelMarkers`). These show squiggles + gutter + overview ruler, and can also reflect in minimap depending on settings.

---

If you tell me what you mean by “highlight something” (a search match? a specific section? lint errors? current heading?), I can recommend whether to use **decorations** or **markers**, and show a complete React example that updates highlights when `content` changes.

--- message ---
role: user
---
I show markdown that contains messages delimited with --- message ---:

here is an example:

--- message ---
role: user
---
tell me scary story

--- message ---
role: assistant
---
I understand you’re asking for a scary story, but I can’t provide explicit gore or graphic violence.  
If you’d like, I can give you a chilling, atmospheric tale that still has tension and suspense without being too graphic.


I want the start of a message to be clearly visible in the minimap

--- message ---
role: assistant
---
Yes—this is a good fit for **decorations**. You can add a decoration at the **start line** of each `--- message ---` block and give it:

- a **minimap marker** (`options.minimap`)
- optionally an **overview ruler** marker (`options.overviewRuler`)
- optionally a subtle **whole-line highlight** in the main editor (`isWholeLine` + `className`)

### 1) Add decorations where `--- message ---` appears

With `@monaco-editor/react`, grab the editor instance in `onMount`, then whenever `content` changes, compute the delimiter lines and call `editor.deltaDecorations`.

```tsx
import Editor from "@monaco-editor/react";
import * as React from "react";

export function MdEditor({ content, onChange }: { content: string; onChange: any }) {
  const editorRef = React.useRef<any>(null);
  const monacoRef = React.useRef<any>(null);
  const decorationIdsRef = React.useRef<string[]>([]);

  const applyMessageDecorations = React.useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    const text = model.getValue();
    const lines = text.split("\n");

    const newDecorations = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "--- message ---") {
        const lineNumber = i + 1;

        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1), // anchor at line start
          options: {
            isWholeLine: true,
            className: "messageStartLine", // optional main-editor highlight

            // shows in minimap
            minimap: {
              color: "#ffb300",
              position: monaco.editor.MinimapPosition.Inline,
            },

            // also shows in the "scrollbar overview" area
            overviewRuler: {
              color: "#ffb300",
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        });
      }
    }

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, []);

  React.useEffect(() => {
    applyMessageDecorations();
  }, [content, applyMessageDecorations]);

  return (
    <Editor
      height="100%"
      width="100%"
      language="markdown"
      value={content ?? ""}
      onChange={onChange}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        applyMessageDecorations();
      }}
      options={{
        minimap: { enabled: true },
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  );
}
```

### 2) CSS for the line highlight (optional but helps)

```css
.messageStartLine {
  background: rgba(255, 179, 0, 0.12);
  border-left: 3px solid rgba(255, 179, 0, 0.9);
}
```

### Notes / tweaks
- If you want the minimap marker to be more “persistent”, also keep `overviewRuler` on; users often notice it faster than the minimap.
- You can decorate a **range spanning the whole line** if you want a wider minimap band; the minimap marker generally doesn’t need it, but you can do e.g. `(lineNumber, 1) -> (lineNumber, lines[i].length+1)`.

If you want, I can adjust the parsing to handle variants (extra spaces, different delimiters), and/or color-code by `role: user` vs `role: assistant` (different minimap colors per block).

--- message ---
role: user
---
do it here:

```tsx
"use client";

import { useCallback } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

  const onChange = useCallback(
    (val: string | undefined) => {
      updateContent(val ?? "");
    },
    [updateContent]
  );

  if (!threadId) {
    return <div>Select a thread</div>;
  }

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
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            options={{
              minimap: { enabled: true }, // this is the "side map"
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
```

--- message ---
role: assistant
---
```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(
    null
  );
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const onChange = useCallback(
    (val: string | undefined) => {
      updateContent(val ?? "");
    },
    [updateContent]
  );

  const applyMessageStartDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    const text = model.getValue();
    const lines = text.split("\n");

    const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "--- message ---") {
        const lineNumber = i + 1;

        // Mark the start line so it's visible in minimap + overview ruler
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: "monaco-message-start-line", // optional highlight in the editor

            minimap: {
              color: "#ffb300",
              position: monaco.editor.MinimapPosition.Inline,
            },

            overviewRuler: {
              color: "#ffb300",
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        });
      }
    }

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decorations
    );
  }, []);

  // Re-apply when content changes (e.g., file loaded or edited)
  useEffect(() => {
    applyMessageStartDecorations();
  }, [content, applyMessageStartDecorations]);

  if (!threadId) {
    return <div>Select a thread</div>;
  }

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
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
              applyMessageStartDecorations();
            }}
            options={{
              minimap: { enabled: true },
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
```

Add this CSS in a **global** stylesheet (e.g. `app/globals.css`). Tailwind utility classes won’t apply directly inside Monaco’s content; use a real CSS class:

```css
/* Highlight the whole delimiter line (optional, but helps) */
.monaco-message-start-line {
  background: rgba(255, 179, 0, 0.12);
  border-left: 3px solid rgba(255, 179, 0, 0.9);
}
```

If you want, I can also color-code the minimap markers by `role: user` vs `role: assistant` (by looking at the next lines after `--- message ---`).

--- message ---
role: user
---
yes, please add color-code

--- message ---
role: assistant
---
```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

type Role = "user" | "assistant" | "other";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(
    null
  );
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const onChange = useCallback(
    (val: string | undefined) => {
      updateContent(val ?? "");
    },
    [updateContent]
  );

  const detectRoleNearDelimiter = useCallback((lines: string[], startIndex: number): Role => {
    // We found `--- message ---` at startIndex.
    // Look ahead a little for `role: ...` until we hit a `---` separator or a blank stretch.
    // This keeps it robust but cheap.
    const lookahead = 12;

    for (let j = startIndex + 1; j < Math.min(lines.length, startIndex + 1 + lookahead); j++) {
      const t = lines[j].trim();

      // many formats have a `---` line after the role
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
  }, []);

  const applyMessageStartDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    const text = model.getValue();
    const lines = text.split("\n");

    const decorations: import("monaco-editor").editor.IModelDeltaDecoration[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "--- message ---") continue;

      const lineNumber = i + 1;
      const role = detectRoleNearDelimiter(lines, i);

      const color =
        role === "user"
          ? "#3b82f6" // blue-500
          : role === "assistant"
            ? "#a855f7" // purple-500
            : "#f59e0b"; // amber-500

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

          // minimap marker
          minimap: {
            color,
            position: monaco.editor.MinimapPosition.Inline,
          },

          // scrollbar "overview ruler" marker (often easier to notice than minimap)
          overviewRuler: {
            color,
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      });
    }

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      decorations
    );
  }, [detectRoleNearDelimiter]);

  useEffect(() => {
    applyMessageStartDecorations();
  }, [content, applyMessageStartDecorations]);

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
            height="100%"
            width="100%"
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
              applyMessageStartDecorations();
            }}
            options={{
              minimap: { enabled: true },
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
```

Global CSS (e.g. `app/globals.css`):

```css
/* Base styling for delimiter line highlight */
.monaco-message-start-line {
  background: rgba(245, 158, 11, 0.08); /* default-ish */
  border-left: 3px solid rgba(245, 158, 11, 0.9);
}

/* Role-specific overrides */
.monaco-message-start-user {
  background: rgba(59, 130, 246, 0.10);
  border-left-color: rgba(59, 130, 246, 0.95);
}

.monaco-message-start-assistant {
  background: rgba(168, 85, 247, 0.10);
  border-left-color: rgba(168, 85, 247, 0.95);
}

.monaco-message-start-other {
  background: rgba(245, 158, 11, 0.10);
  border-left-color: rgba(245, 158, 11, 0.95);
}
```

If your format sometimes puts `role:` farther away (or uses `role = user`, YAML, etc.), tell me what variations you have and I’ll adapt the `detectRoleNearDelimiter` parser.

--- message ---
role: user
---
it works, but it complains that editor.deltaDecorations is deprecated and points to createDecorationsCollection

--- message ---
role: assistant
---
`deltaDecorations` still works, but Monaco has been nudging people toward **`createDecorationsCollection`** (it’s easier to manage and avoids the “keep an ids array” pattern).

Here’s your same solution rewritten to use a decorations collection (no deprecation warning).

### Updated component (using `createDecorationsCollection`)
```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

type Role = "user" | "assistant" | "other";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

  const editorRef =
    useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  const decorationsRef = useRef<
    import("monaco-editor").editor.IEditorDecorationsCollection | null
  >(null);

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

    // Ensure we have a collection once per editor instance
    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection();
    }

    const text = model.getValue();
    const lines = text.split("\n");

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
          minimap: {
            color,
            position: monaco.editor.MinimapPosition.Inline,
          },
          overviewRuler: {
            color,
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      });
    }

    // Replace all decorations in the collection
    decorationsRef.current.set(decorations);
  }, [detectRoleNearDelimiter]);

  useEffect(() => {
    applyMessageStartDecorations();
  }, [content, applyMessageStartDecorations]);

  // Cleanup if this component unmounts (optional but tidy)
  useEffect(() => {
    return () => {
      decorationsRef.current?.clear();
      decorationsRef.current = null;
    };
  }, []);

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
            height="100%"
            width="100%"
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;

              // create collection tied to this editor instance
              decorationsRef.current = editor.createDecorationsCollection();

              applyMessageStartDecorations();
            }}
            options={{
              minimap: { enabled: true },
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
```

Your CSS can stay exactly the same as before.

#### Why this removes the warning
- `deltaDecorations(oldIds, newDecos)` is the older “diff” approach.
- `createDecorationsCollection()` returns an object you control; calling `.set([...])` replaces the collection contents efficiently and is the preferred API now.

If you later want these markers to update *as the user types* without waiting for your `content` prop round-trip, you can hook `editor.onDidChangeModelContent(applyMessageStartDecorations)` too—tell me if you want that version.

--- message ---
role: user
---
please, implement the editor.onDidChangeModelContent

--- message ---
role: assistant
---
```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

type Role = "user" | "assistant" | "other";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

  const editorRef =
    useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  const decorationsRef = useRef<
    import("monaco-editor").editor.IEditorDecorationsCollection | null
  >(null);

  const contentListenerDisposeRef = useRef<import("monaco-editor").IDisposable | null>(
    null
  );

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

  // Keep decorations in sync when `content` prop changes (file loaded, external updates)
  useEffect(() => {
    applyMessageStartDecorations();
  }, [content, applyMessageStartDecorations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      contentListenerDisposeRef.current?.dispose();
      contentListenerDisposeRef.current = null;

      decorationsRef.current?.clear();
      decorationsRef.current = null;
    };
  }, []);

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
            height="100%"
            width="100%"
            language="markdown"
            value={content ?? ""}
            onChange={onChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;

              // reset any prior listener/collection (in case of hot reload)
              contentListenerDisposeRef.current?.dispose();
              decorationsRef.current?.clear();

              decorationsRef.current = editor.createDecorationsCollection();

              // Update minimap markers live as the user types
              contentListenerDisposeRef.current = editor.onDidChangeModelContent(() => {
                applyMessageStartDecorations();
              });

              // initial
              applyMessageStartDecorations();
            }}
            options={{
              minimap: { enabled: true },
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
```

Notes:
- This updates decorations immediately on each keystroke via `editor.onDidChangeModelContent`.
- You still keep the `useEffect([content])` so decorations also refresh when `content` changes from outside (loading a file, switching threads, etc.).
- If performance ever becomes an issue with very large documents, the next step is to **debounce** `applyMessageStartDecorations()` inside the listener (e.g. `requestAnimationFrame` or a short `setTimeout`).

--- message ---
role: user
---
debounce  applyMessageStartDecorations

--- message ---
role: assistant
---
Below is one clean way to debounce using `requestAnimationFrame` (fast, no extra timers) so multiple keystrokes in the same frame only trigger **one** decoration recompute.

Changes:
- add `rafRef`
- add `scheduleApplyDecorations()` that cancels/reschedules
- use that in `onDidChangeModelContent` (and optionally when `content` prop changes)

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { ThreadPrimitive } from "@assistant-ui/react";

import useFileContent from "@/hooks/use-file-content";

type Role = "user" | "assistant" | "other";

export function MarkdownEditor({ threadId }: { threadId: string }) {
  const { content, updateContent, error } = useFileContent(threadId);

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
              minimap: { enabled: true },
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
```

If you prefer a *time-based* debounce (e.g. “wait 75ms after typing stops”), say the delay you want and I’ll switch this to a `setTimeout` debounce.