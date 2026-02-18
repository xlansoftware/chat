import { getSessionId } from "@/lib-server/session"
import { NextRequest, NextResponse } from "next/server"

import { clearStorage } from '@/app/api/storage';

export async function DELETE(request: NextRequest) {
  const sessionId = getSessionId(request)
  clearStorage(sessionId)
  return NextResponse.json({ ok: true })
}
