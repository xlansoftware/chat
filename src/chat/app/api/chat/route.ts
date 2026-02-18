import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { stepCountIs } from "ai";
import { getModel } from "@/lib-server/current-model";
import { NextRequest, NextResponse } from "next/server";
import { setUsage } from "@/lib-server/usage-store";
import { getSessionId } from '@/lib-server/session';

export async function POST(request: NextRequest) {
  const {
    threadId,
    modelName,
    messages,
  }: {
    threadId?: string;
    modelName?: string;
    messages: UIMessage[];
  } = await request.json();

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 }
    );
  }

  if (!modelName) {
    return NextResponse.json(
      { error: "modelName is required" },
      { status: 400 }
    );
  }

  let tools = {};
  const mcpServerEndpoint = process.env.MCP_SERVER_ENDPOINT;

  if (mcpServerEndpoint) {
    const url = new URL(mcpServerEndpoint);
    const mcpClient = await createMCPClient({
      transport: new StreamableHTTPClientTransport(url),
    });
    tools = await mcpClient.tools();
  }

  const model = await getModel(modelName);

  const start = Date.now();

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      openai: {
        reasoningEffort: "low", // "low", "medium", "high"
        reasoningSummary: "auto", // "auto", "none", "always"
        timeout: 60000 * 30,
      },
    },
    stopWhen: stepCountIs(20),
    tools,
  });

  // Persist usage AFTER stream finishes
  result.totalUsage.then(async (totalUsage) => {
    const totalSeconds = (Date.now() - start) / 1000;
    const tokensPerSecond =
      totalSeconds > 0
        ? (totalUsage?.outputTokens ?? 0) / totalSeconds
        : 0;
    await setUsage(threadId, {
      // strip some of the information
      totalUsage: {
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        totalTokens: totalUsage.totalTokens,
      },
      tokensPerSecond: Number(tokensPerSecond.toFixed(2))
    }, getSessionId(request));
  });

  // result.usage.then((usage) => {
  //   setUsage(threadId, { lastStepUsage: usage });
  // });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
