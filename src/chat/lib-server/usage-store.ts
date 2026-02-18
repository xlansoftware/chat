import { getStorage } from "@/app/api/storage";

// lib-server/usage-store.ts
export type UsageRecord = {
  lastStepUsage?: unknown;
  totalUsage?: unknown;
  tokensPerSecond?: number;
  updatedAt: number;
};

export async function setUsage(
  threadId: string,
  data: Partial<UsageRecord>,
  sessionId: string
) {

  const storage = await getStorage(sessionId);
  const node = await storage.getNode(threadId);
  if (!node) return;

  // console.log(`setUsage for ${threadId}: ${JSON.stringify(data, null, 2)}`);

  await storage.writeMetadata(threadId, {
    ...(node.metadata || {}),
    usage: {
      ...(node.metadata?.["usage"] || {}),
      ...data,
      updatedAt: Date.now(),
    }
  })
}

export async function getUsage(threadId: string, sessionId: string) {

  const storage = await getStorage(sessionId);
  const node = await storage.getNode(threadId);

  const result = node?.metadata?.["usage"];

  //console.log(`getUsage for ${threadId}: ${JSON.stringify(result, null, 2)}`);

  return result;
}
