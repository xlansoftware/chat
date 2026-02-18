// app/api/usage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUsage } from "@/lib-server/usage-store";
import { getSessionId } from "@/lib-server/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 }
    );
  }

  const usage = await getUsage(threadId, getSessionId(request));

  if (!usage) {
    return NextResponse.json(
      { error: "No usage found" },
      { status: 404 }
    );
  }

  return NextResponse.json(usage);
}
