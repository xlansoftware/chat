---
title: Understanding Zustand in React
usage:
  totalUsage:
    inputTokens: 1275
    inputTokenDetails:
      noCacheTokens: 1275
      cacheReadTokens: 0
    outputTokens: 843
    outputTokenDetails:
      textTokens: 843
      reasoningTokens: 0
    totalTokens: 2118
    reasoningTokens: 0
    cachedInputTokens: 0
  tokensPerSecond: 48.76
  updatedAt: 1771143284755
---
--- message ---
role: user
---
I am developing web apps using react. I am interested in how zustand works. How can it cause a react component to reload? is there a react API? how zustand works?

--- message ---
role: assistant
---
Zustand makes React components “reload” (re-render) by using React’s external-store subscription mechanism. In modern React, the key API is **`useSyncExternalStore`** (React 18+). Zustand exposes a React hook (`useStore`) that subscribes your component to the store; when the store updates, Zustand notifies subscribers, and React re-renders only the components whose selected slice changed.

## What actually causes a component to re-render?
In React, a component re-renders when:
- its **state** changes (`useState`, `useReducer`)
- its **props** change
- a subscribed **external store** signals an update (via `useSyncExternalStore`)

Zustand uses the third option: **an external store**.

## Is there a React API involved?
Yes. Zustand’s React binding uses:

- **`useSyncExternalStore`** (React 18+) to subscribe safely in concurrent rendering.
- In older versions / older React, libraries used patterns like `useState + useEffect` with manual subscriptions, but the “official” modern way is `useSyncExternalStore`.

Conceptually, React expects three things for an external store:
1. **subscribe(listener)** → register a callback and return an unsubscribe function
2. **getSnapshot()** → read the current store value used for rendering
3. (optional) **getServerSnapshot()** → for SSR hydration consistency

`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)` wires that into React.

## How Zustand works (core idea)
Zustand has two parts:

### 1) Vanilla store (framework-agnostic)
A zustand store is basically:
- an internal `state` object
- `setState(partialOrUpdater)` that updates the state
- `getState()` that returns it
- `subscribe(listener)` that notifies when state changes

When you call `setState`, zustand updates its internal state and calls all listeners.

### 2) React hook binding
The `useStore(selector)` hook:
- subscribes your component to the store
- reads a **selected slice** of state via a selector function
- triggers a re-render when the selected slice changes (by equality check)

## Why don’t all components re-render on every change?
Because you typically use selectors:

```js
const count = useStore(s => s.count)
```

If some other key changes (e.g., `user`), `count` may remain identical, so zustand can avoid re-rendering that component.

Under the hood, the hook does something like:
- snapshot = selector(getState())
- on store change: compute nextSnapshot, compare with previous (usually `Object.is`)
- only if changed → React sees new snapshot and re-renders

## Small mental model (step-by-step)
1. Component renders and calls `useStore(selector)`
2. `useStore` registers a subscription to the store
3. Component uses the returned selected value
4. Some code calls `setState` on the zustand store
5. Store notifies subscribers
6. React’s `useSyncExternalStore` asks for the new snapshot
7. If snapshot differs → React re-renders that component

## Practical implications / tips
- **Use selectors** to keep renders minimal.
- If you select an object that is recreated often, you may re-render more than expected. You can:
  - select primitives
  - select stable references
  - or use an equality function (zustand supports this via variants/middleware, depending on version)

## Quick comparison to Context
React Context updates tend to re-render *all consumers* when the provided value changes (unless you split contexts/memoize carefully). Zustand avoids that by:
- letting each component subscribe to exactly what it needs (selector)
- using external store subscription, not context propagation

---

If you want, paste a small zustand store + component example you have, and I can point out exactly when/why it re-renders and how to structure selectors to minimize renders.