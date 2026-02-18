/* eslint-disable @typescript-eslint/no-explicit-any */
// __tests__/api/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, DELETE, PATCH } from '@/app/api/storage/route';
import { GET as GET_CONTENT, PUT as PUT_CONTENT } from '@/app/api/storage/content/route';
import { NextRequest } from 'next/server';
import type { IStorageService } from '@/lib/storage/IStorageService';

// Mock the storage service
const mockStorage: IStorageService = {
  initialize: vi.fn(),
  createFile: vi.fn(),
  createFolder: vi.fn(),
  deleteNode: vi.fn(),
  renameNode: vi.fn(),
  readContent: vi.fn(),
  writeContent: vi.fn(),
  writeMetadata: vi.fn(),
  getNode: vi.fn(),
  listNodes: vi.fn(),
};

// Mock the getStorage function
vi.mock('@/app/api/storage', () => ({
  getStorage: vi.fn(async () => mockStorage),
}));

// Helper to create NextRequest
function createRequest(
  url: string,
  options: RequestInit = {}
): NextRequest {
  return new NextRequest(new Request(url, options));
}

describe('Storage API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/storage', () => {
    describe('with action=get', () => {
      it('should return a node when it exists', async () => {
        const mockNode = { name: '/test.txt', type: 'file' as const };
        (mockStorage.getNode as any).mockResolvedValueOnce(mockNode);

        const request = createRequest(
          'http://localhost:3000/api/storage?path=/test.txt&action=get'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ node: mockNode });
        expect(mockStorage.getNode).toHaveBeenCalledWith('/test.txt');
      });

      it('should return 404 when node does not exist', async () => {
        (mockStorage.getNode as any).mockResolvedValueOnce(null);

        const request = createRequest(
          'http://localhost:3000/api/storage?path=/nonexistent.txt&action=get'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data).toEqual({ error: 'Node not found' });
      });

      it('should return 400 when path is missing', async () => {
        const request = createRequest(
          'http://localhost:3000/api/storage?action=get'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({ error: 'Path parameter is required' });
      });

      it('should handle errors from storage service', async () => {
        (mockStorage.getNode as any).mockRejectedValueOnce(
          new Error('Storage error')
        );

        const request = createRequest(
          'http://localhost:3000/api/storage?path=/test.txt&action=get'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Storage error' });
      });
    });

    describe('with action=list', () => {
      it('should list nodes in a directory', async () => {
        const mockNodes = [
          { name: '/documents/file1.txt', type: 'file' as const },
          { name: '/documents/file2.txt', type: 'file' as const },
          { name: '/documents/subfolder', type: 'folder' as const },
        ];
        (mockStorage.listNodes as any).mockResolvedValueOnce(mockNodes);
        (mockStorage.getNode as any).mockImplementation((arg: string) => {
          if (arg === '/') return { name: "/", type: "folder" as const };
          if (arg === '/documents') return { name: "/documents", type: "folder" as const };
          return null;
        });

        const request = createRequest(
          'http://localhost:3000/api/storage?path=/documents&action=list'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({
          nodes: mockNodes, breadcrumbs: [
            { name: "/", type: "folder" as const },
            { name: "/documents", type: "folder" as const }
          ]
        });
        expect(mockStorage.listNodes).toHaveBeenCalledWith('/documents');
      });

      it('should return empty array for empty directory', async () => {
        (mockStorage.listNodes as any).mockResolvedValueOnce([]);
        (mockStorage.getNode as any).mockImplementation((arg: string) => {
          if (arg === '/') return { name: "/", type: "folder" as const };
          if (arg === '/documents') return { name: "/documents", type: "folder" as const };
          return null;
        });


        const request = createRequest(
          'http://localhost:3000/api/storage?path=/empty&action=list'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ nodes: [], breadcrumbs: [{ name: '/', type: "folder" }] });
      });

      it('should handle errors when listing', async () => {
        (mockStorage.listNodes as any).mockRejectedValueOnce(
          new Error('Path points to a file, not a folder')
        );

        const request = createRequest(
          'http://localhost:3000/api/storage?path=/file.txt&action=list'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({
          error: 'Path points to a file, not a folder',
        });
      });
    });

    describe('default action (get)', () => {
      it('should get node when action is not specified', async () => {
        const mockNode = { name: '/test.txt', type: 'file' as const };
        (mockStorage.getNode as any).mockResolvedValueOnce(mockNode);

        const request = createRequest(
          'http://localhost:3000/api/storage?path=/test.txt'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ node: mockNode });
      });
    });
  });

  describe('POST /api/storage', () => {
    describe('creating files', () => {
      it('should create a file with metadata', async () => {
        const mockFileNode = { name: '/test.txt', type: 'file' as const };
        (mockStorage.createFile as any).mockResolvedValueOnce(mockFileNode);

        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/test.txt', type: 'file' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toEqual({ node: mockFileNode });
        expect(mockStorage.createFile).toHaveBeenCalledWith('/test.txt');
      });

      it('should create a file', async () => {
        const mockFileNode = { name: '/test.txt', type: 'file' as const, metadata: { title: "file title" } };
        (mockStorage.getNode as any).mockResolvedValueOnce(mockFileNode);

        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/test.txt', type: 'file', metadata: { title: "file title" } }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toEqual({ node: mockFileNode });
        expect(mockStorage.createFile).toHaveBeenCalledWith('/test.txt');
        expect(mockStorage.writeMetadata).toHaveBeenCalledWith('/test.txt', { title: "file title" });
      });

      it('should handle file creation errors', async () => {
        (mockStorage.createFile as any).mockRejectedValueOnce(
          new Error('File already exists')
        );

        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/test.txt', type: 'file' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'File already exists' });
      });
    });

    describe('creating folders', () => {
      it('should create a folder', async () => {
        const mockFolderNode = {
          name: '/documents',
          type: 'folder' as const,
        };
        (mockStorage.createFolder as any).mockResolvedValueOnce(
          mockFolderNode
        );

        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/documents', type: 'folder' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toEqual({ node: mockFolderNode });
        expect(mockStorage.createFolder).toHaveBeenCalledWith('/documents');
      });

      it('should handle folder creation errors', async () => {
        (mockStorage.createFolder as any).mockRejectedValueOnce(
          new Error('Folder already exists')
        );

        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/documents', type: 'folder' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Folder already exists' });
      });
    });

    describe('validation', () => {
      it('should return 400 when path is missing', async () => {
        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ type: 'file' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({ error: 'Path and type are required' });
      });

      it('should return 400 when type is missing', async () => {
        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/test.txt' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({ error: 'Path and type are required' });
      });

      it('should return 400 when type is invalid', async () => {
        const request = createRequest('http://localhost:3000/api/storage', {
          method: 'POST',
          body: JSON.stringify({ path: '/test.txt', type: 'invalid' }),
        });
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toEqual({
          error: 'Type must be either "file" or "folder"',
        });
      });
    });
  });

  describe('DELETE /api/storage', () => {
    it('should delete a node', async () => {
      (mockStorage.deleteNode as any).mockResolvedValueOnce(undefined);

      const request = createRequest(
        'http://localhost:3000/api/storage?path=/test.txt',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockStorage.deleteNode).toHaveBeenCalledWith('/test.txt');
    });

    it('should return 400 when path is missing', async () => {
      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'DELETE',
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Path parameter is required' });
    });

    it('should handle deletion errors', async () => {
      (mockStorage.deleteNode as any).mockRejectedValueOnce(
        new Error('Node not found')
      );

      const request = createRequest(
        'http://localhost:3000/api/storage?path=/nonexistent.txt',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Node not found' });
    });

    it('should handle deleting folders with contents', async () => {
      (mockStorage.deleteNode as any).mockResolvedValueOnce(undefined);

      const request = createRequest(
        'http://localhost:3000/api/storage?path=/documents',
        { method: 'DELETE' }
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockStorage.deleteNode).toHaveBeenCalledWith('/documents');
    });
  });

  describe('PATCH /api/storage', () => {
    it('should rename a node', async () => {
      const mockNode = { name: '/new.txt', type: 'file' as const };
      (mockStorage.renameNode as any).mockResolvedValueOnce(mockNode);

      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({ oldPath: '/old.txt', newPath: '/new.txt' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ node: mockNode });
      expect(mockStorage.renameNode).toHaveBeenCalledWith(
        '/old.txt',
        '/new.txt'
      );
    });

    it('should move a node to a different directory', async () => {
      const mockNode = {
        name: '/documents/file.txt',
        type: 'file' as const,
      };
      (mockStorage.renameNode as any).mockResolvedValueOnce(mockNode);

      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({
          oldPath: '/file.txt',
          newPath: '/documents/file.txt',
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ node: mockNode });
    });

    it('should rename and move simultaneously', async () => {
      const mockNode = {
        name: '/archive/renamed.txt',
        type: 'file' as const,
      };
      (mockStorage.renameNode as any).mockResolvedValueOnce(mockNode);

      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({
          oldPath: '/old.txt',
          newPath: '/archive/renamed.txt',
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ node: mockNode });
    });

    it('should return 400 when oldPath is missing', async () => {
      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({ newPath: '/new.txt' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'oldPath and newPath are required' });
    });

    it('should return 400 when newPath is missing', async () => {
      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({ oldPath: '/old.txt' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'oldPath and newPath are required' });
    });

    it('should handle rename errors', async () => {
      (mockStorage.renameNode as any).mockRejectedValueOnce(
        new Error('Node not found')
      );

      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({
          oldPath: '/nonexistent.txt',
          newPath: '/new.txt',
        }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Node not found' });
    });

    it('should handle destination already exists error', async () => {
      (mockStorage.renameNode as any).mockRejectedValueOnce(
        new Error('Node already exists at destination path')
      );

      const request = createRequest('http://localhost:3000/api/storage', {
        method: 'PATCH',
        body: JSON.stringify({ oldPath: '/old.txt', newPath: '/existing.txt' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Node already exists at destination path',
      });
    });
  });

  describe('GET /api/storage/content', () => {
    it('should read file content', async () => {
      const mockContent = 'Hello, World!';
      (mockStorage.readContent as any).mockResolvedValueOnce(mockContent);

      const request = createRequest(
        'http://localhost:3000/api/storage/content?path=/test.txt'
      );
      const response = await GET_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ content: mockContent });
      expect(mockStorage.readContent).toHaveBeenCalledWith('/test.txt');
    });

    it('should read empty file content', async () => {
      (mockStorage.readContent as any).mockResolvedValueOnce('');

      const request = createRequest(
        'http://localhost:3000/api/storage/content?path=/empty.txt'
      );
      const response = await GET_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ content: '' });
    });

    it('should handle multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      (mockStorage.readContent as any).mockResolvedValueOnce(multilineContent);

      const request = createRequest(
        'http://localhost:3000/api/storage/content?path=/multiline.txt'
      );
      const response = await GET_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ content: multilineContent });
    });

    it('should return 400 when path is missing', async () => {
      const request = createRequest(
        'http://localhost:3000/api/storage/content'
      );
      const response = await GET_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Path parameter is required' });
    });

    it('should handle read errors', async () => {
      (mockStorage.readContent as any).mockRejectedValueOnce(
        new Error('File not found')
      );

      const request = createRequest(
        'http://localhost:3000/api/storage/content?path=/nonexistent.txt'
      );
      const response = await GET_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'File not found' });
    });

    it('should handle reading folder error', async () => {
      (mockStorage.readContent as any).mockRejectedValueOnce(
        new Error('Path points to a folder, not a file')
      );

      const request = createRequest(
        'http://localhost:3000/api/storage/content?path=/documents'
      );
      const response = await GET_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Path points to a folder, not a file' });
    });
  });

  describe('PUT /api/storage/content', () => {
    it('should write content to a file', async () => {
      (mockStorage.writeContent as any).mockResolvedValueOnce(undefined);

      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({
            path: '/test.txt',
            content: 'New content',
          }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockStorage.writeContent).toHaveBeenCalledWith(
        '/test.txt',
        'New content'
      );
    });

    it('should write empty content', async () => {
      (mockStorage.writeContent as any).mockResolvedValueOnce(undefined);

      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({ path: '/test.txt', content: '' }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockStorage.writeContent).toHaveBeenCalledWith('/test.txt', '');
    });

    it('should write multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      (mockStorage.writeContent as any).mockResolvedValueOnce(undefined);

      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({
            path: '/test.txt',
            content: multilineContent,
          }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockStorage.writeContent).toHaveBeenCalledWith(
        '/test.txt',
        multilineContent
      );
    });

    it('should return 400 when path is missing', async () => {
      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({ content: 'test' }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Path and content are required' });
    });

    it('should return 400 when content is missing', async () => {
      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({ path: '/test.txt' }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Path and content are required' });
    });

    it('should handle write errors', async () => {
      (mockStorage.writeContent as any).mockRejectedValueOnce(
        new Error('File not found')
      );

      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({
            path: '/nonexistent.txt',
            content: 'test',
          }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'File not found' });
    });

    it('should handle writing to folder error', async () => {
      (mockStorage.writeContent as any).mockRejectedValueOnce(
        new Error('Path points to a folder, not a file')
      );

      const request = createRequest(
        'http://localhost:3000/api/storage/content',
        {
          method: 'PUT',
          body: JSON.stringify({ path: '/documents', content: 'test' }),
        }
      );
      const response = await PUT_CONTENT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Path points to a folder, not a file' });
    });
  });

  describe('edge cases and special characters', () => {
    it('should handle paths with spaces', async () => {
      const mockNode = {
        name: '/path with spaces/file.txt',
        type: 'file' as const,
      };
      (mockStorage.getNode as any).mockResolvedValueOnce(mockNode);

      const request = createRequest(
        'http://localhost:3000/api/storage?path=/path%20with%20spaces/file.txt&action=get'
      );
      const response = await GET(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockStorage.getNode).toHaveBeenCalledWith(
        '/path with spaces/file.txt'
      );
    });

    it('should handle unicode characters in paths', async () => {
      const mockNode = { name: '/文件.txt', type: 'file' as const };
      (mockStorage.getNode as any).mockResolvedValueOnce(mockNode);

      const request = createRequest(
        'http://localhost:3000/api/storage?path=%2F%E6%96%87%E4%BB%B6.txt&action=get'
      );
      const response = await GET(request);
      await response.json();

      expect(response.status).toBe(200);
      expect(mockStorage.getNode).toHaveBeenCalledWith('/文件.txt');
    });

    it('should handle generic errors without message', async () => {
      (mockStorage.getNode as any).mockRejectedValueOnce({});

      const request = createRequest(
        'http://localhost:3000/api/storage?path=/test.txt&action=get'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});