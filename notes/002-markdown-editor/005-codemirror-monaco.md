---
title: CodeMirror -> Monaco
---
--- message ---
role: user
---
I am developing a react app. I use the CodeMirror editor. does CodeMirror support side map?

--- message ---
role: assistant
---
Yes—CodeMirror can support a “side map”/“minimap” style view, but it depends on which major version you’re using:

## CodeMirror 6 (recommended)
There isn’t a built-in minimap/side-map component in the core packages, but CM6 is extension-based and you can implement it (or use community extensions) by:
- Creating a second `EditorView` that shares the same `EditorState` (or stays synced to it)
- Styling it to be narrow and scaled (like a minimap)
- Syncing selection/scroll between the two views

There are also community minimap extensions/plugins floating around, but quality and maintenance vary.

## CodeMirror 5
Similarly, CodeMirror 5 doesn’t ship with an official minimap either. People typically implement it by:
- Rendering a second CodeMirror instance with smaller font/line-height
- Synchronizing document + scroll position

## Practical note (React)
In React apps, the “two editor views” approach is usually the most straightforward: one main editor + one narrow read-only editor acting as the side map.

If you tell me whether you’re on CodeMirror 5 or 6 (and which React wrapper you’re using), I can point you to the most suitable approach or a specific extension/library.

--- message ---
role: user
---
I use "@uiw/react-codemirror": "^4.25.4" with "@codemirror/lang-markdown": "^6.5.0",

--- message ---
role: assistant
---
You’re on CodeMirror 6 (because `@uiw/react-codemirror` v4 + `@codemirror/lang-*` are CM6). In CM6 there is **no official built-in “side map/minimap”** feature in the core packages.

That said, you *can* build one, typically in one of these ways:

## Option A (most common): “minimap” = a 2nd EditorView synced to the main one
Render a second CodeMirror instance next to the main editor:

- `readOnly: true`, no gutters, no line numbers, no selection
- very small font + tight line-height (or CSS scale)
- keep its document synced (easy via React `value`)
- optionally sync scroll (listen to scroll on one, set scrollTop on the other)

With `@uiw/react-codemirror`, the simplest doc sync is:

- Main editor controls `value` in React state
- Minimap receives the same `value`, but is `readOnly` and styled

Scroll sync: use `onCreateEditor` to capture both `EditorView` objects and add DOM scroll listeners.

## Option B: a custom “overview” extension (harder)
You can write a CM6 extension that draws a compact overview in a `ViewPlugin` (e.g., on a canvas in a side panel) and maps clicks/dragging to document positions. This is more work but can be more performant than a full second editor.

## Community extensions
There are a few community “minimap/overview” experiments for CM6, but there isn’t a universally adopted, officially maintained one like Monaco’s minimap. If you want, tell me what behavior you need (just a tiny preview? clickable? shows highlights?) and I can suggest a concrete implementation approach.

If you describe what you mean by “side map” (minimap preview vs. outline/toc vs. scroll bar annotations), I can tailor the best CM6-compatible solution.

--- message ---
role: user
---
here is my react component:

```ts
"use client";

import CodeMirror from '@uiw/react-codemirror';
import { markdown } from "@codemirror/lang-markdown";

import useFileContent from "@/hooks/use-file-content";
import { useCallback } from 'react';
import { ThreadPrimitive } from '@assistant-ui/react';

export function MarkdownEditor({ threadId }: { threadId: string }) {

  const {
    content,
    updateContent,
    // isLoading,
    error,
  } = useFileContent(threadId);

  const onChange = useCallback((val: string, viewUpdate: unknown) => {
    updateContent(val);
  }, [updateContent]);

  if (!threadId) {
    return <div>Select a thread</div>;
  }

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{
        ["--thread-max-width" as string]: "44rem",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
      >

        {error && (
          <div className="text-sm text-destructive">
            {error}
          </div>
        )}

        <CodeMirror
          className="w-full h-full"
          value={content ?? ""}
          extensions={[markdown()]}
          onChange={onChange}
        />
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
```

please, change it to work with monaco. tell me which package to npm install

--- message ---
role: assistant
---
Install Monaco’s React wrapper:

```bash
npm i @monaco-editor/react monaco-editor
```

Then replace your CodeMirror usage with Monaco:

```ts
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

Notes:
- Monaco’s “side map” is the built-in `minimap` (enabled above).
- `onChange` in Monaco can pass `undefined`, so we coerce to `""`.
- `automaticLayout: true` helps it resize correctly inside flex containers.

If you’re using Next.js and run into “monaco uses window” issues, tell me your Next version and I’ll provide the recommended config (it usually works fine with `"use client"` + `@monaco-editor/react`).