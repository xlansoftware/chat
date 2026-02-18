import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/app/api/storage';
import { MemoryStorageService } from '@/lib/storage/MemoryStorageService';
import { getSessionId } from '@/lib-server/session';

// POST /api/storage/clear
export async function POST(request: NextRequest) {
  // the endpoint is used in the tests
  const storage = await getStorage(getSessionId(request));
  (storage as MemoryStorageService).clear();
  return NextResponse.json({ ok: true });
}
