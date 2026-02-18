---
title: Exploring useSyncExternalStore in React
usage:
  totalUsage:
    inputTokens: 1278
    inputTokenDetails:
      noCacheTokens: 1278
      cacheReadTokens: 0
    outputTokens: 697
    outputTokenDetails:
      textTokens: 697
      reasoningTokens: 0
    totalTokens: 1975
    reasoningTokens: 0
    cachedInputTokens: 0
  tokensPerSecond: 58.76
  updatedAt: 1771143743299
---
--- message ---
role: user
---
I am developing a react app. Show me an example of how useSyncExternalStore works. create a static variable (for example, "count") and allow components to "subscribe" for it's changes.

--- message ---
role: assistant
---
Below is a minimal but complete example of using `useSyncExternalStore` to subscribe React components to an “external store” with a static variable `count`. Any component that calls the hook will re-render when `count` changes.

## 1) External store (module-level “static” state)

```js
// counterStore.js
let count = 0; // "static" (module-level) variable

const listeners = new Set();

/**
 * Called by React to subscribe to store updates.
 * Must return an unsubscribe function.
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Called by React to read the current snapshot of the store.
 * Must be synchronous.
 */
export function getSnapshot() {
  return count;
}

/**
 * Optional, used for SSR/hydration. On the client you can just reuse getSnapshot.
 */
export function getServerSnapshot() {
  return count;
}

function emitChange() {
  for (const listener of listeners) listener();
}

// Store API (mutations)
export function increment() {
  count += 1;
  emitChange();
}

export function decrement() {
  count -= 1;
  emitChange();
}

export function reset() {
  count = 0;
  emitChange();
}
```

## 2) A hook that uses `useSyncExternalStore`

```js
// useCounter.js
import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot } from "./counterStore";

export function useCount() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

## 3) Components subscribing to the store

```jsx
// App.jsx
import React from "react";
import { useCount } from "./useCounter";
import { increment, decrement, reset } from "./counterStore";

function CounterDisplay({ label }) {
  const count = useCount(); // subscribes to external store
  return (
    <div>
      {label}: <strong>{count}</strong>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <h2>useSyncExternalStore example</h2>

      {/* Multiple components subscribed to the same external store */}
      <CounterDisplay label="Display A" />
      <CounterDisplay label="Display B" />

      <div style={{ marginTop: 12 }}>
        <button onClick={decrement}>-</button>{" "}
        <button onClick={increment}>+</button>{" "}
        <button onClick={reset}>reset</button>
      </div>
    </div>
  );
}
```

### How it works (in one paragraph)
- `useSyncExternalStore(subscribe, getSnapshot)` tells React: “Here’s how to subscribe to changes, and here’s how to read the current value.”  
- When you call `increment()`/`decrement()`, the store updates `count` and notifies all listeners.  
- React then calls `getSnapshot()` again; if the returned value changed, subscribed components re-render.

If you want, I can show a TypeScript version, add selector support (subscribe to derived values), or demonstrate a store that integrates with browser events (like `localStorage` or `matchMedia`).

--- message ---
role: user
---
show me a TypeScript version with selector support. let the "state" be an object with { count: number; title: string; } for demonstration

--- message ---
role: assistant
---
### `useSyncExternalStore` + TypeScript + selector support (state: `{count, title}`)

This example implements:
- a tiny external store holding `{ count: number; title: string }`
- `useStore(selector)` so components can subscribe to *derived slices*
- equality comparison so a component only re-renders when its selected value changes

---

## 1) External store (`store.ts`)

```ts
// store.ts
export type State = {
  count: number;
  title: string;
};

type Listener = () => void;

let state: State = { count: 0, title: "Counter" }; // module-level ("static") state
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): State {
  return state;
}

export function getServerSnapshot(): State {
  return state;
}

function emitChange() {
  for (const l of listeners) l();
}

// Basic "setState"
export function setState(
  updater: State | ((prev: State) => State)
): void {
  const next = typeof updater === "function"
    ? (updater as (p: State) => State)(state)
    : updater;

  // Avoid emitting if nothing changed by reference
  if (Object.is(next, state)) return;

  state = next;
  emitChange();
}

// Convenience actions
export const actions = {
  increment() {
    setState(prev => ({ ...prev, count: prev.count + 1 }));
  },
  decrement() {
    setState(prev => ({ ...prev, count: prev.count - 1 }));
  },
  setTitle(title: string) {
    setState(prev => ({ ...prev, title }));
  },
  reset() {
    setState({ count: 0, title: "Counter" });
  },
};
```

---

## 2) Selector hook (`useStore.ts`)

### Option A (recommended): use React’s `useSyncExternalStoreWithSelector`
This is provided by `use-sync-external-store/shim/with-selector` (works in TS, great selector support).

```ts
// useStore.ts
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
import { getServerSnapshot, getSnapshot, subscribe, State } from "./store";

export function useStore<Selected>(
  selector: (state: State) => Selected,
  isEqual: (a: Selected, b: Selected) => boolean = Object.is
): Selected {
  return useSyncExternalStoreWithSelector(
    subscribe,
    getSnapshot,
    getServerSnapshot,
    selector,
    isEqual
  );
}
```

> Install if needed:
```bash
npm i use-sync-external-store
```

### Option B (no extra import): manual selector caching
If you prefer not to use the shim, tell me and I’ll provide a correct manual implementation (it’s slightly more code to avoid unnecessary re-renders).

---

## 3) Demo components (`App.tsx`)

```tsx
// App.tsx
import React from "react";
import { useStore } from "./useStore";
import { actions } from "./store";

function CountView() {
  // Subscribes only to `count`
  const count = useStore(s => s.count);
  console.log("CountView render");
  return <div>Count: <strong>{count}</strong></div>;
}

function TitleView() {
  // Subscribes only to `title`
  const title = useStore(s => s.title);
  console.log("TitleView render");
  return <div>Title: <strong>{title}</strong></div>;
}

function SummaryView() {
  // Select an object slice; pass an equality fn to avoid rerenders
  // when values didn't actually change.
  const summary = useStore(
    s => ({ count: s.count, title: s.title }),
    (a, b) => a.count === b.count && a.title === b.title
  );

  console.log("SummaryView render");
  return (
    <div>
      Summary: {summary.title} ({summary.count})
    </div>
  );
}

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <h2>useSyncExternalStore with selector (TS)</h2>

      <CountView />
      <TitleView />
      <SummaryView />

      <div style={{ marginTop: 12 }}>
        <button onClick={actions.decrement}>-</button>{" "}
        <button onClick={actions.increment}>+</button>{" "}
        <button onClick={actions.reset}>reset</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          placeholder="Set title..."
          onChange={(e) => actions.setTitle(e.target.value)}
        />
      </div>
    </div>
  );
}
```

---

### Notes
- Components only re-render when their *selected value* changes (thanks to the selector + `isEqual`).
- If your selector returns a new object each time (like `{...}`), you should provide an `isEqual` comparator (as shown in `SummaryView`) or memoize differently.

If you want, I can show how to add:
- `batch`-style updates,
- immutable helpers,
- or a `useStore()` overload that returns the whole state when no selector is provided.