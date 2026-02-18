---
title: Text editor
---
--- message ---
role: user
---
I am developing a nextjs app. part of the app is to edit markdown text in the frontend. recommend me a good react editor that supports syntax highlighting. what is the name of the editor that vscode use? is it lightweight?

--- message ---
role: assistant
---
For a Next.js app where users edit Markdown with syntax highlighting, you have a few solid React-friendly choices depending on whether you want “simple Markdown editor” vs “full code-editor experience”.

## Good React Markdown editors with syntax highlighting

### 1) **MDXEditor** (`@mdxeditor/editor`)
- Best “Markdown-focused” editing UX (toolbar, lists, links, tables, etc.)
- Plugin-based, modern React component
- Uses a real editor engine under the hood (Lexical)
- Good choice if you want a *document editor* feel more than a code editor

### 2) **react-markdown-editor-lite**
- Common “split view” style (edit on left / preview on right)
- Often paired with **highlight.js** or **Prism** for highlighting in the preview
- Quick to integrate, but the editing experience is more basic (textarea-like compared to Monaco/CodeMirror)

### 3) **CodeMirror 6** (React wrapper: `@uiw/react-codemirror`)
- Very good balance of capability and bundle size
- Excellent syntax highlighting, theming, keymaps, extensions
- Great if you want a “code editor” feel for Markdown (and you can add features like autocomplete, vim/emacs keymaps, etc.)

### 4) **Monaco Editor** (React wrapper: `@monaco-editor/react`)
- Most “VS Code-like” editing experience
- Strong TypeScript/JS language features, multi-cursor, etc.
- Heavier than CodeMirror in bundle/runtime cost, but very capable

## What editor does VS Code use?
VS Code uses **Monaco Editor**.

- **Name:** Monaco Editor  
- **Repo/product:** “monaco-editor”
- It’s the editor component extracted from VS Code; VS Code itself layers additional UI/services around it.

## Is Monaco lightweight?
Not really.

- Compared to CodeMirror, Monaco is generally **heavier** (larger bundle, more worker setup, more complexity).
- It can be acceptable in many apps, but for a typical Next.js frontend where you just need Markdown editing + highlighting, **CodeMirror 6 is usually the more lightweight choice**.

## Quick recommendation
- If you want **VS Code feel** → **Monaco** (`@monaco-editor/react`)
- If you want **lighter but still “real editor”** → **CodeMirror 6** (`@uiw/react-codemirror`)
- If you want **Markdown-first WYSIWYG-ish tooling** → **MDXEditor**

If you tell me whether you want (1) split preview, (2) toolbar buttons, (3) MDX support, and (4) whether this editor appears on many pages or just an admin screen, I can recommend the best fit and a Next.js-friendly setup (including SSR/dynamic import).