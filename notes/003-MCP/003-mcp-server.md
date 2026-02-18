---
title: MCP server
---
--- message ---
role: user
---
I am developing nextjs app using assistant-ui. I want to add a MCP capabilities to my app. I want to implement basic agent functionality - read/create/edit files or other assets like images, etc. is there something already developed as an interface that I can plug and implement? are the asset management MCPs of vscode and claude publicly available?

--- message ---
role: assistant
---
If what you want is “basic agent” capabilities like **read/create/edit files** (and maybe images/other assets), MCP is a good fit—but today it’s usually done by plugging in an **existing MCP server** (for filesystem, git, etc.) or writing a small custom one for your app’s asset store.

## 1) Is there something already developed you can plug in?
Yes—there are **ready-made MCP servers** you can run and connect to.

### Common “starter” MCP servers
- **Filesystem** server (read/write/list/search within allowed directories)
- **Git** server (status/diff/commit, depending on implementation)
- **GitHub** server (issues/PRs)
- DB servers (Postgres/SQLite, etc.)

The canonical place to look is the official MCP org repos:
- **`modelcontextprotocol/servers`** (a collection of reference servers, including a filesystem server)
- **`modelcontextprotocol/typescript-sdk`** (to implement your own server/client in Node/TS)

The “filesystem” one is typically what people use as the baseline for “agent can edit project files.”

### For “assets like images”
There isn’t one universal “asset management MCP” standard server everyone uses, because assets live in different places (local filesystem vs S3/R2 vs your DB). The typical approach is:

- Use the **filesystem MCP server** if assets are local (e.g., under `public/` or an uploads directory).
- Or create a small custom MCP server with tools like:
  - `asset_list(prefix, mimeType)`
  - `asset_get(id)` (or signed URL)
  - `asset_put(name, bytes|url, mimeType, metadata)`
  - `asset_delete(id)`
  
If you’re in Next.js on Vercel or other serverless environments: writing to local disk is often not persistent, so a custom MCP server that talks to **S3/R2/Supabase Storage** is usually the more practical “asset agent” backend.

## 2) Are the asset management MCPs of VS Code and Claude publicly available?
### VS Code
VS Code’s “agent can edit your workspace” experience is not simply exposed as a standalone, drop-in MCP server you can reuse. VS Code has its own extension APIs / integration points, and while there is MCP-related work in the ecosystem, the exact “workspace file edit” capabilities you see in editors are generally **not published as a generic asset-management MCP server** you can just plug into your Next.js app.

Practical takeaway: don’t expect to “reuse VS Code’s workspace tool” as-is. Use the open filesystem MCP server or implement a purpose-built one.

### Claude (Anthropic)
Claude Desktop popularized MCP usage, and the **example MCP servers** used with Claude Desktop (notably filesystem) are publicly available (via the MCP/Anthropic/MCP org repositories and community servers). However, Claude Desktop’s *built-in application integrations* are not “asset management MCPs” you can directly extract; what’s reusable is the **public MCP server implementations** you run alongside Claude (filesystem, git, etc.).

## 3) What to do in a Next.js + assistant-ui app
A common architecture is:

1. **Run an MCP server** (separately) that has the tools you want (filesystem, assets, etc.).
2. Your Next.js app acts as an **MCP client** (or proxies through an API route) and feeds tool calls/results into your chat/agent loop.
3. assistant-ui is “just the UI”; you still need the agent loop + MCP client wiring.

Implementation-wise, in the Node/TS world, most people use the **MCP TypeScript SDK** to:
- implement a server (`tools/list`, `tools/call`)
- or implement a client that can call tools on an existing server

## 4) Recommended “fast path”
- If you mainly want project file editing: start with the **reference filesystem MCP server** from `modelcontextprotocol/servers`.
- If you need image/assets in cloud storage: implement a small **Storage MCP server** (S3/R2/Supabase) using `modelcontextprotocol/typescript-sdk`.

## 5) Quick questions (so I can point you to the right server pattern)
1. Are the files/assets you want to edit **local on the same machine** as the MCP server, or in **cloud storage** (S3/R2/Supabase)?
2. Is your Next.js app running **serverless** (Vercel) or on a **long-running Node server**?
3. Do you want the agent restricted to a project directory (like a sandbox), or full access?

Answer those and I can suggest the most appropriate existing server(s) and a minimal tool surface for your asset workflow.

--- message ---
role: user
---
I use the tools directly provided as an argument to the streamText method:

```typescript
  const result = streamText({
    model: model, // openai.responses("gpt-5-nano"),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      },
    },
    stopWhen: stepCountIs(10),
    tools: {
      get_model_name: tool({
        description: "Get the name of the current model",
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          console.log('[tool] get_model_name called');
          const result = currentModelName || 'default';
          console.log('[tool] returning:', result);
          return result;
        },
      }),
    },
  });
```

I would like to provide the filesystem MCP tools and handle the execution by myself. I am using virtual filesystem and I want to have control on the actual persistance. is this good approach?

--- message ---
role: assistant
---
Yes—wrapping “filesystem MCP-style” capabilities as `tools:` passed into `streamText()` and executing them yourself is a solid approach, especially since you have a **virtual filesystem** and want **full control over persistence**. Conceptually, you’re implementing “MCP tools” without necessarily running an external MCP server.

The main thing to get right is to treat it like a **tool API contract**: stable tool names, strict schemas, deterministic behavior, and careful sandboxing.

## Why this approach is good
- **You control persistence**: write operations can go through your own commit/transaction layer (DB, object storage, git-like snapshots).
- **You can enforce policy**: path allowlists, size limits, filetype restrictions, quota, rate limits.
- **Works well with Next.js**: no extra MCP server process required; tools run in the same runtime as your app (or behind an API route).

## How to model “filesystem MCP tools” in `streamText`
MCP doesn’t mandate one universal filesystem schema, but there are common primitives. A good minimal set:

- `fs_list`: list directory entries
- `fs_read`: read file (text or bytes metadata)
- `fs_write`: write/overwrite file
- `fs_patch` or `fs_edit`: apply edits (safer than “rewrite whole file” for large files)
- `fs_mkdir`: create directory
- `fs_delete`: remove file/dir
- `fs_stat`: metadata (size, mtime, type)
- `fs_search`: simple text search / glob

### Key design decision: writes should be explicit and auditable
If you want control over persistence, avoid a “magic edit” tool. Prefer either:
1) **write full content** (`fs_write`) + you store a revision, or  
2) **apply patch** (`fs_patch`) + you validate and store a revision.

## Important implementation considerations

### 1) Sandbox paths (must-have)
Never accept raw paths without normalization. Enforce a root, e.g. `"workspaceRootId"` + `"relativePath"`.

Example schema pattern:
- `rootId: string` (or implied from session/project)
- `path: string` (relative only, no `..`, no absolute)
- Normalize and reject anything escaping root.

### 2) Control persistence explicitly
A pattern that works well:
- Virtual FS holds current state in-memory for the session
- On write/patch/delete you either:
  - persist immediately (DB/object store), or
  - stage changes and require an explicit `fs_commit` tool

That “commit tool” can be great if you want the model to batch changes and you want a single persistence transaction.

### 3) Return structured results (and include versioning)
Return a `revision`/`etag` so you can detect races:

- `fs_read` returns `{ content, revision }`
- `fs_write` accepts optional `baseRevision` and rejects if mismatched (or auto-merge if you implement it)

### 4) Large files and token safety
For large content:
- Provide `maxBytes`/`maxChars` on reads
- Provide range reads (`offset`, `length`) or “head/tail”
- Prefer patch operations rather than full rewrites

### 5) Binary assets/images
For images/assets, don’t push raw bytes through the model unless needed. Better:
- `asset_put` accepts a **URL** (or upload handle) + metadata; your server fetches/stores it
- `asset_get` returns a signed URL + metadata
- Optionally `asset_read_base64` for small binaries, but enforce strict size limits

## Do you need “real MCP” here?
Not necessarily. What you’re doing is effectively “MCP-like tools.” If later you want interoperability with Claude Desktop / other MCP clients, then you’d wrap the same backend with an actual MCP server. But for a Next.js app where you own the full stack, inline tools are perfectly valid.

## Practical suggestion: implement a filesystem tool module and plug it in
Keep your `tools:` clean by generating them:

- `createFsTools({ vfs, projectId, policy, persistence }) => tools`
- Each tool calls your VFS layer
- VFS layer calls persistence layer

This keeps your agent/tool wiring independent of storage details.

---

If you share:
1) where your VFS state lives (memory? DB? CRDT?),
2) whether you want *immediate persistence* or *commit-based*,
3) whether you need *text-only* or *binary assets* too,

I can propose a concrete tool schema set (Zod) and the “safe path + revision” strategy that works well with `streamText()`.