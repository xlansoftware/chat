import http from "node:http";
import fs from "node:fs";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

type MCPServersConfig = {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    stderr?: "inherit" | "pipe" | "ignore";
  }>;
};

const LOG_LEVEL = process.env.LOG_LEVEL ?? "debug";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function log(level: LogLevel, msg: string, extra?: unknown) {
  if (levelOrder[level] < levelOrder[LOG_LEVEL as LogLevel]) return;

  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  if (extra !== undefined) {
    console.log(line, safeJson(extra));
  } else {
    console.log(line);
  }
}

function safeJson(value: unknown, maxLen = 2_000) {
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? s.slice(0, maxLen) + "…(truncated)" : s;
  } catch {
    return "[unserializable]";
  }
}

function summarizeMcpMessage(msg: any) {
  if (!msg || typeof msg !== "object") return msg;

  return {
    jsonrpc: msg.jsonrpc,
    id: msg.id,
    method: msg.method,
    hasParams: msg.params !== undefined,
    hasResult: msg.result !== undefined,
    hasError: msg.error !== undefined,
  };
}

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

async function main() {
  log("debug", `LOG_LEVEL=${LOG_LEVEL}`);
  const port = Number(process.env.PORT ?? 8787);

  const cfg = loadConfig();
  const { name, server: mcpSrv } = pickServer(cfg);

  log("info", "[gateway] starting");
  log("info", `[gateway] selected MCP server "${name}"`);

  // Track active sessions for cleanup
  const activeSessions = new Set<{ http: any; stdio: any }>();

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? "UNKNOWN";
    const url = req.url ?? "";

    log("debug", "[http] incoming request", { method, url });

    if (!url.startsWith("/mcp")) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      });
      res.end();
      return;
    }

    // Create NEW transports per request/session
    const httpTransport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    const stdioTransport = new StdioClientTransport({
      command: mcpSrv.command,
      args: mcpSrv.args ?? [],
      env: { ...(mcpSrv.env ?? {}) },
      cwd: mcpSrv.cwd,
      stderr: mcpSrv.stderr ?? "inherit",
    });

    const session = { http: httpTransport, stdio: stdioTransport };
    activeSessions.add(session);

    // Bridge the transports
    httpTransport.onmessage = async (msg: JSONRPCMessage) => {
      log("debug", "[bridge] http → stdio", summarizeMcpMessage(msg));
      try {
        await stdioTransport.send(msg);
      } catch (err) {
        log("error", "[bridge] failed sending http → stdio", err);
      }
    };

    stdioTransport.onmessage = async (msg: JSONRPCMessage) => {
      log("debug", "[bridge] stdio → http", summarizeMcpMessage(msg));
      try {
        await httpTransport.send(msg);
      } catch (err) {
        log("error", "[bridge] failed sending stdio → http", err);
      }
    };

    // Cleanup when session ends
    const cleanup = async () => {
      activeSessions.delete(session);
      try {
        await httpTransport.close();
      } catch { }
      try {
        await stdioTransport.close();
      } catch { }
      log("debug", "[session] cleaned up");
    };

    res.on("close", cleanup);
    res.on("finish", cleanup);

    try {
      // Start stdio transport
      await stdioTransport.start();
      log("debug", "[session] stdio transport started");

      // Monitor stdio process
      try {
        // @ts-expect-error impl detail
        const proc = stdioTransport.process;
        if (proc) {
          proc.once("exit", (code: number, signal: string) => {
            log("warn", "[session] stdio process exited", { code, signal });
            cleanup();
          });
        }
      } catch { }

      // Handle the HTTP request
      await httpTransport.handleRequest(req, res);
    } catch (err) {
      log("error", "[http] MCP transport error", err);
      try {
        res.destroy();
      } catch { }
      await cleanup();
    }
  });

  // Graceful shutdown
  const shutdown = async () => {
    log("info", "[gateway] shutting down...");

    // Close all active sessions
    const cleanups = Array.from(activeSessions).map(async ({ http, stdio }) => {
      try {
        await http.close();
      } catch { }
      try {
        await stdio.close();
      } catch { }
    });

    await Promise.allSettled(cleanups);

    server.close(() => {
      log("info", "[gateway] shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[gateway] listening on :${port}`);
    console.log(`[gateway] MCP server: "${name}" (${mcpSrv.command} ${mcpSrv.args?.join(" ") ?? ""})`);
  });
}

main().catch((e) => {
  log("error", "[gateway] fatal error", e);
  process.exit(1);
});