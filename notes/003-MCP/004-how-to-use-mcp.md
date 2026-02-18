---
title: How to use MCP
---
--- message ---
role: user
---
I am developing a nextjs app using assistant-ui. the the assistant backend I use the ai-sdk package. now, I want to introduce MCP servers. I want to consume them with:

```typescript

import { createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL('https://your-server.com/mcp');
const mcpClient = await createMCPClient({
  transport: new StreamableHTTPClientTransport(url, {
    sessionId: 'session_123',
  }),
});

const tools = await mcpClient.tools();

const result = await streamText({
  model: yourProvider("your-model-id"),
  tools,
  prompt: 'What is the weather in Brooklyn, New York?',
  onFinish: async () => {
    await mcpClient.close();
  },
});
```

I want to use the MCP servers that are implemented at modelcontextprotocol/servers, but they are using the StdioServerTransport transport in their code and I do not see a option or configuration that I can provide to expose them via HTTP. How are they planned to be used? Do I have to copy the code in my project?

--- message ---
role: assistant
---
Most of the servers in `modelcontextprotocol/servers` are **designed to be “local tools” launched by a host** (Claude Desktop, a custom agent runtime, etc.) as **separate processes**, and then spoken to over **stdio**. That’s why they ship with (and document) `StdioServerTransport`: the *host* spawns the server process and communicates via stdin/stdout. They are not “HTTP services” by default.

So you generally have two ways to use them:

## 1) Use them as intended: run them via stdio (no copying)
If your Next.js backend runs in a Node environment where you can spawn processes (not Edge), you can connect to those servers using the **client stdio transport** (instead of HTTP).

Conceptually:

- Next.js (server runtime) spawns `mcp-server-xyz` as a child process
- You use `StdioClientTransport` to talk to it
- You pass `tools` into `streamText(...)`

Example (rough sketch; exact import path may differ depending on your MCP SDK version):

```ts
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const mcpClient = await createMCPClient({
  transport: new StdioClientTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-whatever"],
    // env, cwd, etc if needed
  }),
});

const tools = await mcpClient.tools();

const result = await streamText({
  model: yourProvider("your-model-id"),
  tools,
  prompt: "What is the weather in Brooklyn, New York?",
  onFinish: async () => {
    await mcpClient.close();
  },
});
```

This is the “normal” way to consume `modelcontextprotocol/servers`: **your app is the host**.

### Important constraint
This approach typically **won’t work in Next.js Edge Runtime or most serverless environments** that don’t allow spawning long-lived processes. It works best in:
- a dedicated Node server
- a container (Docker)
- a VM
- local dev

## 2) If you want HTTP: you need a gateway/wrapper
`StreamableHTTPClientTransport` expects an MCP server that is already exposed over the **Streamable HTTP** transport. The servers in `modelcontextprotocol/servers` generally do not expose that themselves.

To use them over HTTP, you’d run an **HTTP “bridge” service** that:
- accepts Streamable HTTP requests
- internally connects to the stdio-based server (by spawning it), or directly hosts the server logic
- forwards messages between HTTP and stdio

You do **not** have to copy the server code, but you *do* need an extra component somewhere that provides HTTP.

Typical patterns:

- **Gateway spawns stdio servers on demand** (per session) and maps them to HTTP sessions.
- **Gateway runs inside a container** with the MCP servers installed, and your Next.js app talks to it via HTTP.

Whether you write this gateway yourself or use a community one depends on what you’re deploying; the official servers repo is primarily aimed at the stdio host model.

---

### Which should you choose?
- If your Next.js backend can reliably spawn processes (Node runtime, not Edge): **use stdio**.
- If you need browser-friendly networking / remote tools / serverless constraints: **run an MCP HTTP gateway** as a separate service and use your existing `StreamableHTTPClientTransport`.

If you tell me your deployment target (Vercel Edge, Vercel Node serverless, self-hosted Node, Docker, etc.), I can recommend the cleanest architecture and show a concrete setup for that environment.

--- message ---
role: user
---
I am deploying the nextjs app in a standalone mode with docker compose. can I spawn the mcp server as a service with docker compose and still use the stdio as transport?

--- message ---
role: assistant
---
No — **stdio transport only works when the host process can spawn and directly wire to the MCP server process’s stdin/stdout.** That means the MCP server must be a **child process of your Next.js server process** (same container / same OS process tree).

If you run the MCP server as a separate Docker Compose service (separate container), there is **no practical way to attach to that container’s stdin/stdout as a transport**. Docker networking connects containers over TCP/HTTP, not by sharing process stdio streams.

### What you can do instead

#### Option A (common): Spawn the MCP server from inside the Next.js container (still stdio)
This keeps stdio, and works well in “standalone Next.js in Docker”:

- Install the MCP server package(s) in the Next image (or have `npx -y` download them at runtime).
- Use the MCP **stdio client transport** and spawn the server as a child process.

This is the closest to “intended usage” of `modelcontextprotocol/servers`.

**Dockerfile idea:** include node + dependencies needed by the server (some servers require extra OS packages).

#### Option B: Run the MCP server in its own Compose service, but expose it over HTTP (requires a gateway)
If you want a separate Compose service, then you need a network transport:

- Put an **MCP-over-HTTP gateway** in front of the stdio server, or
- Implement/host the server using an HTTP transport.

Then your Next.js container uses:

```ts
new StreamableHTTPClientTransport(new URL("http://mcp-service:port/mcp"))
```

But that requires an HTTP-capable MCP endpoint; the stdio servers don’t become HTTP servers just by being in a container.

### Practical recommendation for your setup (Docker Compose)
- If you’re okay with the MCP servers living *inside* the Next container: **use stdio** (Option A).
- If you want MCP servers as separate services: **use an HTTP gateway** (Option B).

If you tell me which MCP servers you want to run (e.g. filesystem, postgres, github, etc.), I can outline:
- what extra OS deps they need in Docker, and
- a clean Compose layout for either “spawn inside Next container” or “separate gateway service”.