import { getModelForSummary } from "@/lib-server/current-model";
import { streamText } from "ai";

export async function POST(req: Request) {
  const { firstMessage, modelName } = await req.json();

  const model = await getModelForSummary(modelName);
  if (!model) {
    console.log(`--- fallback`)
    const title = fallbackTitleFromMessage(firstMessage);

    return new Response(streamString(title), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const result = await streamText({
    model,
    system:
      "Generate a concise, descriptive conversation title (max 6 words). No punctuation.",
    prompt: firstMessage,
    providerOptions: {
      openai: {
        reasoningEffort: "low", // "low", "medium", "high"
        reasoningSummary: "none", // "auto", "none", "always"
      },
    },

  });

  const stream = new ReadableStream({
    async start(controller) {
      for await (const delta of result.textStream) {
        controller.enqueue(delta);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function fallbackTitleFromMessage(message: string): string {
  return message
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, 6)
    .join(" ")
    .slice(0, 40);
}

function streamString(text: string, delayMs = 0) {
  return new ReadableStream({
    async start(controller) {
      for (const char of text) {
        controller.enqueue(char);
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      controller.close();
    },
  });
}
