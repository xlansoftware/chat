---
title: CodeMirror size
---
--- message ---
role: user
---
I am developing a nextjs app with CodeMirror editor. I am replacing a textarea. help me refine the size of the CodeMirror component. The textarea was warking properly with:

```tsx
<textarea
        className="min-h-[300px] w-full rounded-md border p-2 h-full"
        value={content || ""}
        onChange={(e) => updateContent(e.target.value)}
      />
```

now I replace it with:
```tsx
      <CodeMirror
        className="min-h-[300px] w-full rounded-md border p-2 h-full"
        value={content ?? ""}
        extensions={[markdown()]}
        onChange={onChange} />
```

but  the width and the height of the CodeMirror are not ok. help me

--- message ---
role: assistant
---
CodeMirror’s DOM isn’t a single `<textarea>` that honors `min-height/height` the same way. The wrapper you’re styling (`className` on `<CodeMirror />`) often isn’t the element that actually controls the editor’s scroll area height, so you need to style the *inner* CodeMirror elements too.

Here are a few reliable approaches (pick one).

## 1) Style the internal `.cm-editor` / `.cm-scroller` via a wrapper (recommended)

```tsx
<div className="w-full min-h-[300px] h-full rounded-md border">
  <CodeMirror
    value={content ?? ""}
    extensions={[markdown()]}
    onChange={onChange}
    className="
      w-full h-full
      [&_.cm-editor]:h-full
      [&_.cm-editor]:min-h-[300px]
      [&_.cm-scroller]:h-full
      [&_.cm-content]:p-2
    "
  />
</div>
```

Notes:
- Border/radius are put on the wrapper so it’s predictable.
- Padding should be applied to `.cm-content` (not the outermost div), otherwise you can get weird sizing.

If you want it to *always* be at least 300px tall even when `h-full` can’t resolve (common), change the scroller line to min-height too:

```tsx
[&_.cm-scroller]:min-h-[300px]
```

## 2) Force a fixed height (simplest)

```tsx
<div className="w-full h-[300px] rounded-md border">
  <CodeMirror
    value={content ?? ""}
    extensions={[markdown()]}
    onChange={onChange}
    className="
      h-full
      [&_.cm-editor]:h-full
      [&_.cm-scroller]:h-full
      [&_.cm-content]:p-2
    "
  />
</div>
```

## 3) Make sure `h-full` actually has a parent height

`h-full` only works if *every parent up the tree* has an explicit height. If your textarea “worked” mainly because of `min-h-[300px]`, then `h-full` on CodeMirror won’t help unless the container has a height.

So either:
- remove `h-full` entirely and rely on `min-h-[300px]`, or
- give the parent layout a height (e.g. `h-screen`, `flex-1`, etc.)

Example in a flex layout:

```tsx
<div className="flex flex-col h-screen">
  <div className="flex-1 min-h-0 rounded-md border">
    <CodeMirror
      value={content ?? ""}
      extensions={[markdown()]}
      onChange={onChange}
      className="
        h-full
        [&_.cm-editor]:h-full
        [&_.cm-scroller]:h-full
        [&_.cm-content]:p-2
      "
    />
  </div>
</div>
```

`min-h-0` is important in flex containers so the editor can actually shrink and scroll instead of overflowing.

---

If you paste your surrounding layout markup (parent divs/classes), I can tell you whether `h-full` can resolve in your case and give the exact Tailwind classes to use.

--- message ---
role: user
---
the classes do not work. show me how to update the component width and height directly on resize

--- message ---
role: assistant
---
To resize CodeMirror “directly” when the container is resized, don’t rely on Tailwind classes on the React component. Instead:

1) Wrap the editor in a resizable container (`resize: both`)
2) Use a `ResizeObserver` to read the container’s size
3) Apply that size to CodeMirror’s actual DOM (`view.dom.style.width/height`)
4) Call `view.requestMeasure()` so CodeMirror re-measures/layouts

Below is a working pattern for **@uiw/react-codemirror**.

## Resizable CodeMirror (updates width/height on resize)

```tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import type { EditorView } from "@codemirror/view";

export function ResizableMarkdownEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (val: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  // optional: store size if you want to show it or persist it
  const [size, setSize] = useState({ width: 0, height: 300 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;

      const w = Math.floor(cr.width);
      const h = Math.floor(cr.height);

      setSize({ width: w, height: h });

      // Apply size directly to CodeMirror root DOM node
      const view = viewRef.current;
      if (view) {
        view.dom.style.width = `${w}px`;
        view.dom.style.height = `${h}px`;
        view.requestMeasure(); // important: force re-measure/layout
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 300,
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        overflow: "hidden",
        resize: "both",      // user can drag-resize
        minHeight: 300,
        minWidth: 280,
      }}
    >
      <CodeMirror
        value={content ?? ""}
        extensions={[markdown()]}
        onChange={onChange}
        // Capture the EditorView so we can set its DOM size
        onCreateEditor={(view) => {
          viewRef.current = view;
          // set initial size immediately (in case observer hasn't fired yet)
          const el = containerRef.current;
          if (el) {
            const r = el.getBoundingClientRect();
            view.dom.style.width = `${Math.floor(r.width)}px`;
            view.dom.style.height = `${Math.floor(r.height)}px`;
            view.requestMeasure();
          }
        }}
      />
    </div>
  );
}
```

### Notes / gotchas
- If you’re in a flex layout, make sure the parent allows shrinking (`min-height: 0`) or your resizable div may not behave.
- The key is setting size on `EditorView.dom` and calling `requestMeasure()`.

If you tell me which CodeMirror wrapper you’re using (confirm it’s `@uiw/react-codemirror` or something else) and your surrounding layout (flex/grid?), I can adapt this to your exact structure.