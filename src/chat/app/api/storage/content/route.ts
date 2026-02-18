// app/api/storage/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/app/api/storage';
import { getSessionId } from '@/lib-server/session';

// GET /api/storage/content?path=/some/file.txt - Read file content
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    const storage = await getStorage(getSessionId(request));
    const content = await storage.readContent(path);

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to read content' },
      { status: 500 }
    );
  }
}

// PUT /api/storage/content - Write file content
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, content } = body;

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: 'Path and content are required' },
        { status: 400 }
      );
    }

    const storage = await getStorage(getSessionId(request));

    await storage.writeContent(path, content);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to write content' },
      { status: 500 }
    );
  }
}