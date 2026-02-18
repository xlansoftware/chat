import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileSystemStorageService } from '@/lib/storage/FileSystemStorageService';
import { IStorageService } from '@/lib/storage/IStorageService';
import { MemoryStorageService } from '@/lib/storage/MemoryStorageService';

describe('MemoryStorageService', () => {
  let storage: IStorageService;
  let testBasePath: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testBasePath = path.join(__dirname, '__test_storage__', `test_${Date.now()}_${Math.random()}`);
    // storage = new FileSystemStorageService(testBasePath);
    storage = new MemoryStorageService();
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialize', () => {
    it('should create the base directory if it does not exist', async () => {
      const newBasePath = path.join(__dirname, '__test_storage__', `init_test_${Date.now()}`);
      const newStorage = new FileSystemStorageService(newBasePath);

      await newStorage.initialize();

      const stats = await fs.stat(newBasePath);
      expect(stats.isDirectory()).toBe(true);

      // Cleanup
      await fs.rm(newBasePath, { recursive: true, force: true });
    });
  });

  describe('createFile', () => {
    it('should create a new file at the specified path', async () => {
      const result = await storage.createFile('/test.txt');

      expect(result).toEqual({
        name: '/test.txt',
        type: 'file',
      });

      const node = await storage.getNode('/test.txt');
      expect(node?.type).toBe('file');
    });

    it('should create parent directories if they do not exist', async () => {
      const result = await storage.createFile('/documents/nested/file.txt');

      expect(result.name).toBe('/documents/nested/file.txt');

      const node = await storage.getNode('/documents/nested/file.txt');
      expect(node?.type).toBe('file');
    });

    it('should throw error if file already exists', async () => {
      await storage.createFile('/test.txt');

      await expect(storage.createFile('/test.txt')).rejects.toThrow(
        'File already exists at path: /test.txt'
      );
    });

    it('should create an empty file', async () => {
      await storage.createFile('/empty.txt');
      const content = await storage.readContent('/empty.txt');

      expect(content).toBe('');
    });
  });

  describe('createFolder', () => {
    it('should create a new folder at the specified path', async () => {
      const result = await storage.createFolder('/documents');

      expect(result).toEqual({
        name: '/documents',
        type: 'folder',
      });

      const node = await storage.getNode('/documents');
      expect(node?.type).toBe('folder');
    });

    it('should create nested folders', async () => {
      const result = await storage.createFolder('/documents/projects/work');

      expect(result.name).toBe('/documents/projects/work');

      const node = await storage.getNode('/documents/projects/work');
      expect(node?.type).toBe('folder');
    });

    it('should throw error if folder already exists', async () => {
      await storage.createFolder('/documents');

      await expect(storage.createFolder('/documents')).rejects.toThrow(
        'Folder already exists at path: /documents'
      );
    });
  });

  describe('deleteNode', () => {
    it('should delete a file', async () => {
      await storage.createFile('/test.txt');
      await storage.deleteNode('/test.txt');

      const node = await storage.getNode('/test.txt');
      expect(node).toBeNull();
    });

    it('should delete an empty folder', async () => {
      await storage.createFolder('/documents');
      await storage.deleteNode('/documents');

      const node = await storage.getNode('/documents');
      expect(node).toBeNull();
    });

    it('should delete a folder with contents recursively', async () => {
      await storage.createFolder('/documents');
      await storage.createFile('/documents/file1.txt');
      await storage.createFile('/documents/file2.txt');
      await storage.createFolder('/documents/nested');
      await storage.createFile('/documents/nested/file3.txt');

      await storage.deleteNode('/documents');

      const node = await storage.getNode('/documents');
      expect(node).toBeNull();
    });

    it('should throw error if node does not exist', async () => {
      await expect(storage.deleteNode('/nonexistent.txt')).rejects.toThrow(
        'Node not found at path: /nonexistent.txt'
      );
    });
  });

  describe('renameNode', () => {
    it('should rename a file in the same directory', async () => {
      await storage.createFile('/old.md');
      await storage.writeContent('/old.md', 'content');

      const result = await storage.renameNode('/old.md', '/new.md');

      expect(result).toEqual({
        name: '/new.md',
        type: 'file',
      });

      const oldNode = await storage.getNode('/old.md');
      expect(oldNode).toBeNull();

      const newNode = await storage.getNode('/new.md');
      expect(newNode?.type).toBe('file');

      const content = await storage.readContent('/new.md');
      expect(content).toBe('content');
    });

    it('should move a file to a different directory', async () => {
      await storage.createFile('/file.txt');
      await storage.createFolder('/documents');
      await storage.writeContent('/file.txt', 'test content');

      const result = await storage.renameNode('/file.txt', '/documents/file.txt');

      expect(result.name).toBe('/documents/file.txt');

      const oldNode = await storage.getNode('/file.txt');
      expect(oldNode).toBeNull();

      const newNode = await storage.getNode('/documents/file.txt');
      expect(newNode?.type).toBe('file');

      const content = await storage.readContent('/documents/file.txt');
      expect(content).toBe('test content');
    });

    it('should rename and move a file simultaneously', async () => {
      await storage.createFile('/old.txt');
      await storage.createFolder('/archive');
      await storage.writeContent('/old.txt', 'archived');

      const result = await storage.renameNode('/old.txt', '/archive/new.txt');

      expect(result.name).toBe('/archive/new.txt');

      const content = await storage.readContent('/archive/new.txt');
      expect(content).toBe('archived');
    });

    it('should rename a folder', async () => {
      await storage.createFolder('/old_folder');
      await storage.createFile('/old_folder/file.txt');

      const result = await storage.renameNode('/old_folder', '/new_folder');

      expect(result).toEqual({
        name: '/new_folder',
        type: 'folder',
      });

      const oldNode = await storage.getNode('/old_folder');
      expect(oldNode).toBeNull();

      const newNode = await storage.getNode('/new_folder');
      expect(newNode?.type).toBe('folder');

      // Check that contents were moved
      const fileNode = await storage.getNode('/new_folder/file.txt');
      expect(fileNode?.type).toBe('file');
    });

    it('should create parent directory if it does not exist', async () => {
      await storage.createFile('/file.txt');

      await storage.renameNode('/file.txt', '/deep/nested/path/file.txt');

      const node = await storage.getNode('/deep/nested/path/file.txt');
      expect(node?.type).toBe('file');
    });

    it('should throw error if source does not exist', async () => {
      await expect(storage.renameNode('/nonexistent.txt', '/new.txt')).rejects.toThrow(
        'Node not found at path: /nonexistent.txt'
      );
    });

    it('should throw error if destination already exists', async () => {
      await storage.createFile('/file1.txt');
      await storage.createFile('/file2.txt');

      await expect(storage.renameNode('/file1.txt', '/file2.txt')).rejects.toThrow(
        'Node already exists at destination path: /file2.txt'
      );
    });
  });

  describe('readContent', () => {
    it('should read the content of a file', async () => {
      await storage.createFile('/test.txt');
      await storage.writeContent('/test.txt', 'Hello, World!');

      const content = await storage.readContent('/test.txt');

      expect(content).toBe('Hello, World!');
    });

    it('should read empty file content', async () => {
      await storage.createFile('/empty.txt');

      const content = await storage.readContent('/empty.txt');

      expect(content).toBe('');
    });

    it('should throw error if file does not exist', async () => {
      await expect(storage.readContent('/nonexistent.txt')).rejects.toThrow(
        'Node not found at path: /nonexistent.txt'
      );
    });

    it('should throw error if path points to a folder', async () => {
      await storage.createFolder('/documents');

      // folders have content too. it is stored in hidden "readme.md" file
      expect(await storage.readContent('/documents')).toEqual("");

      await storage.writeContent("/documents", "something");
      await storage.writeMetadata("/documents", { opa: "tropa" });

      expect(await storage.readContent('/documents')).toEqual("something");
    });
  });

  describe('writeContent', () => {
    it('should write content to a file', async () => {
      await storage.createFile('/test.txt');
      await storage.writeContent('/test.txt', 'New content');

      const content = await storage.readContent('/test.txt');

      expect(content).toBe('New content');
    });

    it('should overwrite existing content', async () => {
      await storage.createFile('/test.txt');
      await storage.writeContent('/test.txt', 'First content');
      await storage.writeContent('/test.txt', 'Second content');

      const content = await storage.readContent('/test.txt');

      expect(content).toBe('Second content');
    });

    it('should handle multi-line content', async () => {
      await storage.createFile('/multiline.txt');
      const multilineContent = 'Line 1\nLine 2\nLine 3';

      await storage.writeContent('/multiline.txt', multilineContent);
      const content = await storage.readContent('/multiline.txt');

      expect(content).toBe(multilineContent);
    });

    it('should throw error if file does not exist', async () => {
      await expect(storage.writeContent('/nonexistent.txt', 'content')).rejects.toThrow(
        'Node not found at path: /nonexistent.txt'
      );
    });
  });

  describe('getNode', () => {
    it('should return a file node', async () => {
      await storage.createFile('/test.txt');

      const node = await storage.getNode('/test.txt');

      expect(node).toEqual({
        name: '/test.txt',
        type: 'file',
      });
    });

    it('should return a folder node', async () => {
      await storage.createFolder('/documents');

      const node = await storage.getNode('/documents');

      expect(node).toEqual({
        name: '/documents',
        type: 'folder',
      });
    });

    it('should return null if node does not exist', async () => {
      const node = await storage.getNode('/nonexistent.txt');

      expect(node).toBeNull();
    });
  });

  describe('listNodes', () => {
    it('should list all nodes in a folder', async () => {
      await storage.createFolder('/documents');
      await storage.createFile('/documents/file1.txt');
      await storage.createFile('/documents/file2.txt');
      await storage.createFolder('/documents/subfolder');

      const nodes = await storage.listNodes('/documents');

      expect(nodes).toHaveLength(3);
      expect(nodes).toEqual(
        expect.arrayContaining([
          { name: '/documents/file1.txt', type: 'file' },
          { name: '/documents/file2.txt', type: 'file' },
          { name: '/documents/subfolder', type: 'folder' },
        ])
      );
    });

    it('should return empty array for empty folder', async () => {
      await storage.createFolder('/empty');

      const nodes = await storage.listNodes('/empty');

      expect(nodes).toEqual([]);
    });

    it('should list nodes in root folder', async () => {
      await storage.createFile('/root1.txt');
      await storage.createFile('/root2.txt');
      await storage.createFolder('/rootfolder');

      const nodes = await storage.listNodes('/');

      expect(nodes).toHaveLength(3);
      expect(nodes).toEqual(
        expect.arrayContaining([
          { name: '/root1.txt', type: 'file' },
          { name: '/root2.txt', type: 'file' },
          { name: '/rootfolder', type: 'folder' },
        ])
      );
    });

    it('should throw error if folder does not exist', async () => {
      await expect(storage.listNodes('/nonexistent')).rejects.toThrow(
        'Folder not found at path: /nonexistent'
      );
    });

    it('should throw error if path points to a file', async () => {
      await storage.createFile('/test.txt');

      await expect(storage.listNodes('/test.txt')).rejects.toThrow(
        'Folder not found at path: /test.txt'
      );
    });
  });

  describe('metadata operations', () => {
    describe('writeMetadata', () => {
      it('should write metadata to a markdown file', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', {
          title: 'My Document',
          author: 'John Doe',
          tags: ['test', 'markdown'],
        });

        const node = await storage.getNode('/document.md');
        expect(node?.metadata).toEqual({
          title: 'My Document',
          author: 'John Doe',
          tags: ['test', 'markdown'],
        });
      });

      it('should update existing metadata in a markdown file', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', {
          title: 'Original Title',
          version: 1,
        });

        await storage.writeMetadata('/document.md', {
          title: 'Updated Title',
          version: 2,
          published: true,
        });

        const node = await storage.getNode('/document.md');
        expect(node?.metadata).toEqual({
          title: 'Updated Title',
          version: 2,
          published: true,
        });
      });

      it.skip('should write metadata to a non-markdown file', async () => {
        // the case is not supported by the FileSystemStorage
        await storage.createFile('/data.json');

        await storage.writeMetadata('/data.json', {
          format: 'json',
          version: '1.0',
        });

        const node = await storage.getNode('/data.json');
        expect(node?.metadata).toEqual({
          format: 'json',
          version: '1.0',
        });
      });

      it('should write metadata to a folder', async () => {
        await storage.createFolder('/projects');

        await storage.writeMetadata('/projects', {
          description: 'All my projects',
          count: 5,
        });

        const node = await storage.getNode('/projects');
        expect(node?.metadata).toEqual({
          description: 'All my projects',
          count: 5,
        });
      });

      it('should handle empty metadata', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', {});

        const node = await storage.getNode('/document.md');
        expect(node?.metadata).toBeUndefined();
      });

      it('should handle various data types in metadata', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', {
          title: 'Test',
          count: 42,
          enabled: true,
          disabled: false,
          empty: null,
          tags: ['tag1', 'tag2'],
          config: { key: 'value' },
        });

        const node = await storage.getNode('/document.md');
        expect(node?.metadata).toEqual({
          title: 'Test',
          count: 42,
          enabled: true,
          disabled: false,
          empty: null,
          tags: ['tag1', 'tag2'],
          config: { key: 'value' },
        });
      });

      it('should throw error if node does not exist', async () => {
        await expect(
          storage.writeMetadata('/nonexistent.md', { title: 'Test' })
        ).rejects.toThrow('Node not found at path: /nonexistent.md');
      });
    });

    describe('markdown front matter integration', () => {
      it('should preserve metadata when writing content to markdown file', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', {
          title: 'My Title',
          author: 'Jane Doe',
        });

        await storage.writeContent('/document.md', 'This is the content.');

        const node = await storage.getNode('/document.md');
        expect(node?.metadata).toEqual({
          title: 'My Title',
          author: 'Jane Doe',
        });

        const content = await storage.readContent('/document.md');
        expect(content).toBe('This is the content.');
      });

      it('should read content without front matter from markdown file', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', {
          title: 'Test Document',
        });

        await storage.writeContent('/document.md', 'Content here.');

        const content = await storage.readContent('/document.md');
        expect(content).toBe('Content here.');
        expect(content).not.toContain('---');
        expect(content).not.toContain('title:');
      });

      it('should handle markdown files with existing front matter', async () => {
        await storage.createFile('/document.md');

        // Write content with front matter manually
        const fullContent = `---
title: Initial Title
date: 2024-01-01
---
Initial content`;

        // Simulate writing the full content (this would bypass the normal writeContent)
        // For testing, we'll use the normal flow
        await storage.writeMetadata('/document.md', {
          title: 'Initial Title',
          date: '2024-01-01',
        });
        await storage.writeContent('/document.md', 'Initial content');

        const node = await storage.getNode('/document.md');
        expect(node?.metadata?.title).toBe('Initial Title');

        // Update metadata
        await storage.writeMetadata('/document.md', {
          title: 'Updated Title',
          date: '2024-01-01',
          edited: true,
        });

        const updatedNode = await storage.getNode('/document.md');
        expect(updatedNode?.metadata).toEqual({
          title: 'Updated Title',
          date: '2024-01-01',
          edited: true,
        });

        // Content should remain unchanged
        const content = await storage.readContent('/document.md');
        expect(content).toBe('Initial content');
      });

      it('should handle multiple metadata updates', async () => {
        await storage.createFile('/document.md');

        await storage.writeMetadata('/document.md', { version: 1 });
        await storage.writeContent('/document.md', 'Version 1 content');

        await storage.writeMetadata('/document.md', { version: 2, status: 'draft' });

        await storage.writeMetadata('/document.md', { version: 3, status: 'published' });

        const node = await storage.getNode('/document.md');
        expect(node?.metadata).toEqual({
          version: 3,
          status: 'published',
        });

        const content = await storage.readContent('/document.md');
        expect(content).toBe('Version 1 content');
      });

      it('should handle markdown files without front matter initially', async () => {
        await storage.createFile('/simple.md');
        await storage.writeContent('/simple.md', 'Just plain content');

        const nodeBeforeMeta = await storage.getNode('/simple.md');
        expect(nodeBeforeMeta?.metadata).toBeUndefined();

        // Add metadata
        await storage.writeMetadata('/simple.md', {
          title: 'Now with metadata',
        });

        const nodeAfterMeta = await storage.getNode('/simple.md');
        expect(nodeAfterMeta?.metadata).toEqual({
          title: 'Now with metadata',
        });

        const content = await storage.readContent('/simple.md');
        expect(content).toBe('Just plain content');
      });
    });

    describe('listNodes with metadata', () => {
      it('should include metadata for markdown files when listing', async () => {
        await storage.createFolder('/documents');

        await storage.createFile('/documents/doc1.md');
        await storage.writeMetadata('/documents/doc1.md', {
          title: 'Document 1',
          priority: 'high',
        });

        await storage.createFile('/documents/doc2.md');
        await storage.writeMetadata('/documents/doc2.md', {
          title: 'Document 2',
          priority: 'low',
        });

        await storage.createFile('/documents/readme.txt');

        const nodes = await storage.listNodes('/documents');

        expect(nodes).toHaveLength(3);

        const doc1 = nodes.find(n => n.name === '/documents/doc1.md');
        expect(doc1?.metadata).toEqual({
          title: 'Document 1',
          priority: 'high',
        });

        const doc2 = nodes.find(n => n.name === '/documents/doc2.md');
        expect(doc2?.metadata).toEqual({
          title: 'Document 2',
          priority: 'low',
        });

        const readme = nodes.find(n => n.name === '/documents/readme.txt');
        expect(readme?.metadata).toBeUndefined();
      });

      it('should not include metadata for markdown files without front matter', async () => {
        await storage.createFolder('/notes');

        await storage.createFile('/notes/plain.md');
        await storage.writeContent('/notes/plain.md', 'No metadata here');

        const nodes = await storage.listNodes('/notes');

        const plain = nodes.find(n => n.name === '/notes/plain.md');
        expect(plain?.metadata).toEqual({});
      });
    });

    describe('renameNode with metadata', () => {
      it('should preserve metadata when renaming a markdown file', async () => {
        await storage.createFile('/old.md');
        await storage.writeMetadata('/old.md', {
          title: 'Important Document',
          version: 5,
        });
        await storage.writeContent('/old.md', 'Content');

        await storage.renameNode('/old.md', '/new.md');

        const newNode = await storage.getNode('/new.md');
        expect(newNode?.metadata).toEqual({
          title: 'Important Document',
          version: 5,
        });

        const content = await storage.readContent('/new.md');
        expect(content).toBe('Content');
      });

      it('should preserve metadata when moving a markdown file', async () => {
        await storage.createFile('/document.md');
        await storage.writeMetadata('/document.md', {
          author: 'Alice',
          category: 'research',
        });

        await storage.createFolder('/archive');
        await storage.renameNode('/document.md', '/archive/document.md');

        const movedNode = await storage.getNode('/archive/document.md');
        expect(movedNode?.metadata).toEqual({
          author: 'Alice',
          category: 'research',
        });
      });

      it('should preserve metadata when renaming a folder', async () => {
        await storage.createFolder('/project');
        await storage.writeMetadata('/project', {
          description: 'My project',
          active: true,
        });

        await storage.renameNode('/project', '/my_project');

        const renamedNode = await storage.getNode('/my_project');
        expect(renamedNode?.metadata).toEqual({
          description: 'My project',
          active: true,
        });
      });

      it('should preserve metadata for nested markdown files when renaming parent folder', async () => {
        await storage.createFolder('/docs');
        await storage.createFile('/docs/guide.md');
        await storage.writeMetadata('/docs/guide.md', {
          title: 'User Guide',
          chapter: 1,
        });

        await storage.renameNode('/docs', '/documentation');

        const movedFile = await storage.getNode('/documentation/guide.md');
        expect(movedFile?.metadata).toEqual({
          title: 'User Guide',
          chapter: 1,
        });
      });
    });

    describe('getNode with metadata', () => {
      it('should return node with metadata for markdown files', async () => {
        await storage.createFile('/article.md');
        await storage.writeMetadata('/article.md', {
          title: 'My Article',
          published: true,
          tags: ['tech', 'tutorial'],
        });

        const node = await storage.getNode('/article.md');

        expect(node).toEqual({
          name: '/article.md',
          type: 'file',
          metadata: {
            title: 'My Article',
            published: true,
            tags: ['tech', 'tutorial'],
          },
        });
      });

      it('should return node without metadata for non-markdown files', async () => {
        await storage.createFile('/data.json');

        const node = await storage.getNode('/data.json');

        expect(node).toEqual({
          name: '/data.json',
          type: 'file',
        });
      });

      it('should return node without metadata for markdown files without front matter', async () => {
        await storage.createFile('/simple.md');

        const node = await storage.getNode('/simple.md');

        expect(node).toEqual({
          name: '/simple.md',
          type: 'file',
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle paths without leading slash', async () => {
      await storage.createFile('no-slash.txt');

      const node = await storage.getNode('no-slash.txt');
      expect(node?.type).toBe('file');
    });

    it('should handle special characters in file names', async () => {
      await storage.createFile('/file with spaces.txt');
      await storage.createFile('/file-with-dashes.txt');
      await storage.createFile('/file_with_underscores.txt');

      const node1 = await storage.getNode('/file with spaces.txt');
      const node2 = await storage.getNode('/file-with-dashes.txt');
      const node3 = await storage.getNode('/file_with_underscores.txt');

      expect(node1?.type).toBe('file');
      expect(node2?.type).toBe('file');
      expect(node3?.type).toBe('file');
    });

    it('should handle deep nesting', async () => {
      const deepPath = '/a/b/c/d/e/f/g/deep.txt';
      await storage.createFile(deepPath);

      const node = await storage.getNode(deepPath);
      expect(node?.type).toBe('file');
    });

    it('should handle unicode characters in file names', async () => {
      await storage.createFile('/文件.txt');
      await storage.createFile('/файл.txt');

      const node1 = await storage.getNode('/文件.txt');
      const node2 = await storage.getNode('/файл.txt');

      expect(node1?.type).toBe('file');
      expect(node2?.type).toBe('file');
    });

    it('should handle .markdown extension for metadata', async () => {
      await storage.createFile('/document.markdown');
      await storage.writeMetadata('/document.markdown', {
        title: 'Markdown File',
      });

      const node = await storage.getNode('/document.markdown');
      expect(node?.metadata).toEqual({
        title: 'Markdown File',
      });
    });

    it('should handle metadata with special characters', async () => {
      await storage.createFile('/special.md');
      await storage.writeMetadata('/special.md', {
        title: 'Title with "quotes" and \'apostrophes\'',
        description: 'Multi\nline\ntext',
        path: '/some/path/here',
      });

      const node = await storage.getNode('/special.md');
      expect(node?.metadata?.title).toBe('Title with "quotes" and \'apostrophes\'');
      expect(node?.metadata?.description).toBe('Multi\nline\ntext');
      expect(node?.metadata?.path).toBe('/some/path/here');
    });
  });
});