/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageClient } from '@/lib/storage-client';

// Mock fetch globally
global.fetch = vi.fn();

describe('StorageClient', () => {
  let client: StorageClient;

  beforeEach(() => {
    client = new StorageClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createFile', () => {
    it('should create a file and return the file node', async () => {
      const mockFileNode = { name: '/test.txt', type: 'file' as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ node: mockFileNode }),
      });

      const result = await client.createNode("file", '/test.txt', { title: "file title" });

      expect(result).toEqual(mockFileNode);
      expect(global.fetch).toHaveBeenCalledWith('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/test.txt', type: 'file', metadata: { title: "file title" } }),
      });
    });

    it('should throw error when creation fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File already exists' }),
      });

      await expect(client.createNode("file", '/test.txt', {})).rejects.toThrow(
        'File already exists'
      );
    });

    it('should throw generic error when no error message provided', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      await expect(client.createNode("file", '/test.txt', {})).rejects.toThrow(
        'Failed to create file'
      );
    });
  });

  describe('createFolder', () => {
    it('should create a folder and return the folder node', async () => {
      const mockFolderNode = { name: '/documents', type: 'folder' as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ node: mockFolderNode }),
      });

      const result = await client.createNode("folder", '/documents', { title: "folder title" });

      expect(result).toEqual(mockFolderNode);
      expect(global.fetch).toHaveBeenCalledWith('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/documents', type: 'folder', metadata: { title: "folder title" } }),
      });
    });

    it('should throw error when creation fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Folder already exists' }),
      });

      await expect(client.createNode("folder", '/documents', {})).rejects.toThrow(
        'Folder already exists'
      );
    });
  });

  describe('deleteNode', () => {
    it('should delete a node', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.deleteNode('/test.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2Ftest.txt',
        { method: 'DELETE' }
      );
    });

    it('should handle paths with special characters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.deleteNode('/path with spaces/file.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2Fpath%20with%20spaces%2Ffile.txt',
        { method: 'DELETE' }
      );
    });

    it('should throw error when deletion fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Node not found' }),
      });

      await expect(client.deleteNode('/test.txt')).rejects.toThrow(
        'Node not found'
      );
    });
  });

  describe('renameNode', () => {
    it('should rename/move a node and return the updated node', async () => {
      const mockNode = { name: '/new.txt', type: 'file' as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ node: mockNode }),
      });

      const result = await client.renameNode('/old.txt', '/new.txt');

      expect(result).toEqual(mockNode);
      expect(global.fetch).toHaveBeenCalledWith('/api/storage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: '/old.txt', newPath: '/new.txt' }),
      });
    });

    it('should throw error when rename fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Destination already exists' }),
      });

      await expect(
        client.renameNode('/old.txt', '/new.txt')
      ).rejects.toThrow('Destination already exists');
    });
  });

  describe('readContent', () => {
    it('should read file content', async () => {
      const mockContent = 'Hello, World!';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: mockContent }),
      });

      const result = await client.readContent('/test.txt');

      expect(result).toBe(mockContent);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage/content?path=%2Ftest.txt'
      );
    });

    it('should handle empty content', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: '' }),
      });

      const result = await client.readContent('/empty.txt');

      expect(result).toBe('');
    });

    it('should throw error when read fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File not found' }),
      });

      await expect(client.readContent('/test.txt')).rejects.toThrow(
        'File not found'
      );
    });

    it('should handle paths with special characters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'test' }),
      });

      await client.readContent('/path with spaces/file.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage/content?path=%2Fpath%20with%20spaces%2Ffile.txt'
      );
    });
  });

  describe('writeContent', () => {
    it('should write content to a file', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.writeContent('/test.txt', 'New content');

      expect(global.fetch).toHaveBeenCalledWith('/api/storage/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/test.txt', content: 'New content' }),
      });
    });

    it('should handle empty content', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.writeContent('/test.txt', '');

      expect(global.fetch).toHaveBeenCalledWith('/api/storage/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/test.txt', content: '' }),
      });
    });

    it('should handle multiline content', async () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.writeContent('/test.txt', multilineContent);

      expect(global.fetch).toHaveBeenCalledWith('/api/storage/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/test.txt', content: multilineContent }),
      });
    });

    it('should throw error when write fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File not found' }),
      });

      await expect(
        client.writeContent('/test.txt', 'content')
      ).rejects.toThrow('File not found');
    });
  });

  describe('getNode', () => {
    it('should get a file node', async () => {
      const mockNode = { name: '/test.txt', type: 'file' as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ node: mockNode }),
      });

      const result = await client.getNode('/test.txt');

      expect(result).toEqual(mockNode);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2Ftest.txt&action=get'
      );
    });

    it('should get a folder node', async () => {
      const mockNode = { name: '/documents', type: 'folder' as const };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ node: mockNode }),
      });

      const result = await client.getNode('/documents');

      expect(result).toEqual(mockNode);
    });

    it('should return null when node does not exist', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Node not found' }),
      });

      const result = await client.getNode('/nonexistent.txt');

      expect(result).toBeNull();
    });

    it('should throw error for other failures', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(client.getNode('/test.txt')).rejects.toThrow(
        'Internal server error'
      );
    });
  });

  describe('listNodes', () => {
    it('should list nodes in a directory', async () => {
      const mockNodes = [
        { name: '/documents/file1.txt', type: 'file' as const },
        { name: '/documents/file2.txt', type: 'file' as const },
        { name: '/documents/subfolder', type: 'folder' as const },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: mockNodes, breadcrumbs: [{ name: "/documents", type: "folder" }] }),
      });

      const result = await client.listNodes('/documents');

      expect(result.nodes).toEqual(mockNodes);
      expect(result.breadcrumbs).toEqual([{ name: "/documents", type: "folder" }]);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2Fdocuments&action=list'
      );
    });

    it('should return empty array for empty directory', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [] }),
      });

      const result = await client.listNodes('/empty');

      expect(result.nodes).toEqual([]);
    });

    it('should list nodes in root directory', async () => {
      const mockNodes = [
        { name: '/file.txt', type: 'file' as const },
        { name: '/folder', type: 'folder' as const },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: mockNodes }),
      });

      const result = await client.listNodes('/');

      expect(result.nodes).toEqual(mockNodes);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2F&action=list'
      );
    });

    it('should throw error when listing fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Folder not found' }),
      });

      await expect(client.listNodes('/nonexistent')).rejects.toThrow(
        'Folder not found'
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(client.getNode('/test.txt')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle invalid JSON responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(client.getNode('/test.txt')).rejects.toThrow(
        'Invalid JSON'
      );
    });
  });

  describe('URL encoding', () => {
    it('should properly encode special characters in paths', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ node: { name: '/test file.txt', type: 'file' } }),
      });

      await client.getNode('/test file.txt');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2Ftest%20file.txt&action=get'
      );
    });

    it('should handle paths with unicode characters', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nodes: [] }),
      });

      await client.listNodes('/文件夹');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/storage?path=%2F%E6%96%87%E4%BB%B6%E5%A4%B9&action=list'
      );
    });
  });
});