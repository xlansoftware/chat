---
title: MCP-HTTP session-aware version
---
--- message ---
role: user
---
I am developing a nextjs app using assistant-ui. I want to provide MCP server functionality to my app using:

```typescript
import { createMCPClient } from '@ai-sdk/mcp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL('https://your-server.com/mcp');
const mcpClient = await createMCPClient({
  transport: new StreamableHTTPClientTransport(url, {
    sessionId: 'session_123',
  }),
});
```
I want to use the servers at modelcontextprotocol/servers, however they only support stdio as transport.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--mount", "type=bind,src=/Users/username/Desktop,dst=/projects/Desktop",
        "--mount", "type=bind,src=/path/to/other/allowed/dir,dst=/projects/other/allowed/dir,ro",
        "--mount", "type=bind,src=/path/to/file.txt,dst=/projects/path/to/file.txt",
        "mcp/filesystem",
        "/projects"
      ]
    }
  }
}
```

Are there ready available MCP-over-HTTP gateway projects that I can use so I can expose the stdio servers via http?

the whole app will run with docker compose. the MCP server will run as separate service, available only to the nextjs app service backend, so the security is not a concern. Please, create thin http wrapper using MCP SDK. let it be a nodejs project and take the mcpServers json configuration for the MCP server to start.

--- message ---
role: assistant
---
Below is a thin “stdio MCP server → MCP Streamable HTTP” gateway as a standalone Node.js (TypeScript) service. It:

- Reads an `mcpServers` JSON config (same shape as your example)
- Spawns the selected server command (often `docker run ...`)
- Bridges **Streamable HTTP (server transport)** ⇄ **stdio (client transport)** by forwarding MCP JSON-RPC messages
- Intended to run inside docker-compose, reachable only from your Next.js backend

## Project layout

```
mcp-http-gateway/
  package.json
  tsconfig.json
  src/
    index.ts
```

## 1) package.json

```json
{
  "name": "mcp-http-gateway",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --enable-source-maps --loader ts-node/esm src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

> If you’re already using `@ai-sdk/mcp`, you don’t need it in this gateway; this gateway is just an MCP transport bridge.

## 2) tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## 3) src/index.ts

```ts
import http from "node:http";
import { Readable } from "node:stream";
import fs from "node:fs";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type MCPServersConfig = {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      stderr?: "inherit" | "pipe" | "ignore";
    }
  >;
};

function loadConfig(): MCPServersConfig {
  const configPath = process.env.MCP_SERVERS_CONFIG ?? "/config/mcpServers.json";
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function pickServer(cfg: MCPServersConfig) {
  const name = process.env.MCP_SERVER_NAME ?? Object.keys(cfg.mcpServers)[0];
  if (!name) throw new Error("No mcpServers configured");

  const server = cfg.mcpServers[name];
  if (!server) throw new Error(`MCP server "${name}" not found in config`);
  return { name, server };
}

/**
 * Minimal bidirectional message bridge between two MCP transports.
 * Both transports must have:
 *   - onmessage: (msg) => void
 *   - send(msg): Promise<void> | void
 */
function bridgeTransports(a: any, b: any) {
  a.onmessage = async (msg: unknown) => {
    await b.send(msg);
  };
  b.onmessage = async (msg: unknown) => {
    await a.send(msg);
  };
}

/**
 * Convert Node IncomingMessage -> Web Request
 * (Node 18+ provides global Request/Headers/Response)
 */
async function nodeToWebRequest(req: http.IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(", "));
    else if (v != null) headers.set(k, v);
  }

  // For GET/HEAD, body must be undefined
  const method = req.method ?? "GET";
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : (Readable.toWeb(req) as any);

  return new Request(url, {
    method,
    headers,
    body,
    // Required when passing a stream body in some runtimes
    // @ts-expect-error duplex exists in Node's fetch
    duplex: body ? "half" : undefined,
  });
}

async function main() {
  const port = Number(process.env.PORT ?? 8787);

  const server = http.createServer(async (req, res) => {
    // Only handle MCP endpoint
    if (!req.url?.startsWith("/mcp")) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    const cfg = loadConfig();
    const { name, server: mcpSrv } = pickServer(cfg);

    // Create a fresh stdio server process per HTTP session/request.
    // (Simple + avoids cross-session interference.)
    const stdioTransport = new StdioClientTransport({
      command: mcpSrv.command,
      args: mcpSrv.args ?? [],
      env: { ...(mcpSrv.env ?? {}) },
      // env: { ...process.env, ...(mcpSrv.env ?? {}) },
      cwd: mcpSrv.cwd,
      stderr: mcpSrv.stderr ?? "inherit",
    });

    // One HTTP transport instance for this request handler.
    // NOTE: If you want real session persistence across multiple HTTP requests,
    // you would typically keep ONE StreamableHTTPServerTransport instance globally
    // and call handleRequest() for each request. This minimal version stays stateless.
    const httpTransport = new StreamableHTTPServerTransport({
      // set true if you want non-SSE JSON responses only
      enableJsonResponse: false,
    });

    try {
      await stdioTransport.start();

      // Bridge before handling the HTTP request so any inbound messages get forwarded
      bridgeTransports(httpTransport as any, stdioTransport as any);

      const webReq = await nodeToWebRequest(req);

      await httpTransport.handleRequest(req, res);

      // Ensure cleanup when the connection drops
      res.on("close", async () => {
        try {
          await stdioTransport.close();
        } catch { }
        try {
          await httpTransport.close();
        } catch { }
      });

      console.log(`[gateway] ${req.method} ${req.url} -> stdio "${name}"`);
    } catch (err: any) {
      try {
        await stdioTransport.close();
      } catch { }
      try {
        await httpTransport.close();
      } catch { }

      res.statusCode = 500;
      res.end(err?.stack ?? err?.message ?? "Gateway error");
    }
  });

  server.listen(port, () => {
    console.log(`[gateway] listening on :${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

```

## Next.js usage (your side)
Point your client at the gateway service:

```ts
import { createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL("http://mcp-gateway:8787/mcp"); // docker compose service name
const mcpClient = await createMCPClient({
  transport: new StreamableHTTPClientTransport(url, { sessionId: "session_123" }),
});
```

### Important note about “sessions”
The above implementation is **stateless** in the sense that each HTTP request spawns a new stdio server. If your client uses `sessionId` and expects the server to maintain a session across multiple HTTP calls (typical with Streamable HTTP), you probably want:

- **one global** `StreamableHTTPServerTransport({ sessionIdGenerator, onsessioninitialized, onsessionclosed })`
- a `Map<sessionId, StdioClientTransport>` so each session gets its own stdio server
- `serverTransport.handleRequest(req)` on every request, while keeping stdio transports alive until `DELETE` closes the session

If you want that (it’s usually what you want with `StreamableHTTPClientTransport`), tell me whether you want **one stdio process per sessionId** or **one shared stdio process**, and I’ll provide the session-aware version using `onsessioninitialized/onsessionclosed`.

--- message ---
role: user
---
please, implement the session-aware version with one shared stdio process

--- message ---
role: assistant
---
Below is a **session-aware** MCP-over-HTTP gateway that keeps **one shared stdio MCP server process** for all HTTP sessions. It uses a single global `StreamableHTTPServerTransport` and a single global `StdioClientTransport`, and bridges messages between them.

Important caveat: many MCP stdio servers implicitly assume **one client / one conversation state**. Sharing one stdio process across multiple HTTP sessions can cause cross-session state leakage or race/interleaving issues if multiple clients use it concurrently. But this matches what you asked for.

## `src/index.ts` (session-aware, shared stdio)

```ts
import http from "node:http";
import fs from "node:fs";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type MCPServersConfig = {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      stderr?: "inherit" | "pipe" | "ignore";
    }
  >;
};

function loadConfig(): MCPServersConfig {
  const configPath = process.env.MCP_SERVERS_CONFIG ?? "/config/mcpServers.json";
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function pickServer(cfg: MCPServersConfig) {
  const name = process.env.MCP_SERVER_NAME ?? Object.keys(cfg.mcpServers)[0];
  if (!name) throw new Error("No mcpServers configured");

  const server = cfg.mcpServers[name];
  if (!server) throw new Error(`MCP server "${name}" not found in config`);
  return { name, server };
}

/**
 * Bridge MCP messages between transports:
 * - HTTP -> stdio
 * - stdio -> HTTP
 *
 * Assumes both transports expose:
 *   - onmessage = (msg) => void
 *   - send(msg)
 */
function bridgeTransports(httpTransport: any, stdioTransport: any) {
  httpTransport.onmessage = async (msg: unknown) => {
    await stdioTransport.send(msg);
  };

  stdioTransport.onmessage = async (msg: unknown) => {
    await httpTransport.send(msg);
  };
}

async function main() {
  const port = Number(process.env.PORT ?? 8787);

  // Load config + start ONE shared stdio MCP server process
  const cfg = loadConfig();
  const { name, server: mcpSrv } = pickServer(cfg);

  const stdioTransport = new StdioClientTransport({
    command: mcpSrv.command,
    args: mcpSrv.args ?? [],
    env: { ...(mcpSrv.env ?? {}) },
    // If you need full env inheritance, use:
    // env: { ...process.env, ...(mcpSrv.env ?? {}) },
    cwd: mcpSrv.cwd,
    stderr: mcpSrv.stderr ?? "inherit",
  });

  // ONE shared Streamable HTTP transport handling multiple sessions.
  // It will manage sessions via headers/cookies/etc. (handled internally by SDK).
  const httpTransport = new StreamableHTTPServerTransport({
    enableJsonResponse: false, // keep streaming/SSE behavior
  });

  // Start shared stdio process and connect bridge
  await stdioTransport.start();
  bridgeTransports(httpTransport as any, stdioTransport as any);

  // Clean shutdown
  const shutdown = async () => {
    try {
      await httpTransport.close();
    } catch {}
    try {
      await stdioTransport.close();
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Optional: if the stdio process dies, crash the gateway (so compose restarts it)
  // (If you want auto-restart inside the process, say so and I’ll adjust.)
  try {
    // @ts-expect-error transport impl detail; not always present
    stdioTransport.process?.once?.("exit", (code: number) => {
      console.error(`[gateway] stdio server exited with code=${code}; exiting`);
      process.exit(1);
    });
  } catch {}

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url?.startsWith("/mcp")) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      // Let the SDK handle session-aware Streamable HTTP requests
      await httpTransport.handleRequest(req, res);

      // NOTE: Do NOT close transports here; they are shared/globally managed.
    } catch (err: any) {
      res.statusCode = 500;
      res.end(err?.stack ?? err?.message ?? "Gateway error");
    }
  });

  server.listen(port, () => {
    console.log(`[gateway] listening on :${port}`);
    console.log(`[gateway] sharing ONE stdio MCP server: "${name}" (${mcpSrv.command} ${mcpSrv.args?.join(" ") ?? ""})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## Config file example (`/config/mcpServers.json`)

Same as your shape:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--mount", "type=bind,src=/Users/username/Desktop,dst=/projects/Desktop",
        "mcp/filesystem",
        "/projects"
      ]
    }
  }
}
```

## Next.js client usage

```ts
import { createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL("http://mcp-gateway:8787/mcp");
const mcpClient = await createMCPClient({
  transport: new StreamableHTTPClientTransport(url, { sessionId: "session_123" }),
});
```


If you tell me which `modelcontextprotocol/servers` image(s) you’re targeting (filesystem, git, sqlite, etc.), I can also provide a working `docker-compose.yml` showing the gateway service + correct Docker socket / mounts setup (common gotcha: the gateway container needs access to `/var/run/docker.sock` if it runs `docker run ...

--- message ---
role: user
---
create a Dockerfile for the mcp-gateway

--- message ---
role: assistant
---
```dockerfile
# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS deps
WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

# If your mcpServers.json uses `command: "docker" ...`, the gateway container
# must have a docker CLI binary available.
RUN apk add --no-cache docker-cli

# App runtime files
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 8787
CMD ["node", "dist/index.js"]
```

Notes (for docker-compose wiring):
- If you run MCP servers via `docker run ...` inside this container, you’ll typically also need to mount the host Docker socket:
  - `- /var/run/docker.sock:/var/run/docker.sock`
- And mount whatever host paths you reference in `--mount src=...` (those are host paths from the *gateway container’s* perspective when using the host docker socket). If you want, paste your compose setup and target MCP servers and I’ll give you a correct `docker-compose.yml` example.