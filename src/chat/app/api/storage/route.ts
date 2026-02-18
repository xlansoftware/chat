// app/api/storage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/app/api/storage';
import { getParentPaths } from '@/lib-server/get-parent-paths';
import { getSessionId } from '@/lib-server/session';

// GET /api/storage?path=/some/path - Get node info or list directory
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');
    const action = searchParams.get('action'); // 'get' or 'list'

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    const storage = await getStorage(getSessionId(request));

    if (action === 'list') {
      // List nodes in a directory
      const nodes = await storage.listNodes(path);
      // breadcrumbs
      const p = getParentPaths(path, true);
      const breadcrumbs = (await Promise.all(p.map((b) => storage.getNode(b))))
        .filter(Boolean); // path may not exist

      return NextResponse.json({ nodes, breadcrumbs });
    } else {
      // Get single node
      const node = await storage.getNode(path);
      if (!node) {
        return NextResponse.json(
          { error: 'Node not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ node });
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to get node' },
      { status: 500 }
    );
  }
}

// POST /api/storage - Create file or folder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, type, metadata } = body;

    if (!path || !type) {
      return NextResponse.json(
        { error: 'Path and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'file' && type !== 'folder') {
      return NextResponse.json(
        { error: 'Type must be either "file" or "folder"' },
        { status: 400 }
      );
    }

    const storage = await getStorage(getSessionId(request));

    let node;
    if (type === 'file') {
      node = await storage.createFile(path);
    } else {
      node = await storage.createFolder(path);
    }

    if (metadata && Object.keys(metadata).length > 0) {
      await storage.writeMetadata(path, metadata);
      node = await storage.getNode(path);
    }

    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to create node' },
      { status: 500 }
    );
  }
}

// DELETE /api/storage?path=/some/path - Delete node
export async function DELETE(request: NextRequest) {
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
    await storage.deleteNode(path);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to delete node' },
      { status: 500 }
    );
  }
}

// PATCH /api/storage - Rename/move node
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldPath, newPath } = body;

    if (!oldPath || !newPath) {
      return NextResponse.json(
        { error: 'oldPath and newPath are required' },
        { status: 400 }
      );
    }

    const storage = await getStorage(getSessionId(request));
    const node = await storage.renameNode(oldPath, newPath);

    return NextResponse.json({ node });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to rename node' },
      { status: 500 }
    );
  }
}