import { UIMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { markdownToMessages, messagesToMarkdown } from "@/lib-server/convert-md-message";
import { getStorage } from "@/app/api/storage";
import { updateFolderSummary } from "@/lib-server/folder-summary";
import { getSessionId } from "@/lib-server/session";

export async function POST(request: NextRequest) {
  try {
    const { path, messages }: { path: string, messages: UIMessage[] } = await request.json();

    // console.log(JSON.stringify(messages, null, 2));

    const storage = await getStorage(getSessionId(request));

    const content = messagesToMarkdown(messages);
    await storage.writeContent(path, content);

    await updateFolderSummary(storage, path);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { error: 'path query parameter is required' },
      { status: 500 }
    );
  }

  const storage = await getStorage(getSessionId(request));

  const content = await storage.readContent(path);
  const result = markdownToMessages(content);
  return NextResponse.json({ messages: result });
}