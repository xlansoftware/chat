// app/api/storage/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/app/api/storage';
import { updateFolderSummary } from '@/lib-server/folder-summary';
import { getSessionId } from '@/lib-server/session';

// PUT /api/storage/metadata - Write node metadata
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, metadata, append } = body;

    if (!path || metadata === undefined) {
      return NextResponse.json(
        { error: 'Path and metadata are required' },
        { status: 400 }
      );
    }

    const storage = await getStorage(getSessionId(request));

    if (append) {
      const node = await storage.getNode(path);
      await storage.writeMetadata(path, {
        ...(node?.metadata || {}),
        ...metadata
      });
    } else {
      await storage.writeMetadata(path, metadata);
    }

    const node = await storage.getNode(path);

    await updateFolderSummary(storage, path);

    return NextResponse.json({ success: true, node });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to write metadata' },
      { status: 500 }
    );
  }
}