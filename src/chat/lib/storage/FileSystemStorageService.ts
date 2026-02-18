import { Stats } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { IStorageService } from './IStorageService';
import { FileNode, FolderNode, Node } from '@/types/nodes';
import yaml from 'yaml';

export class FileSystemStorageService implements IStorageService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  /**
   * Converts an absolute logical path to a physical filesystem path
   */
  private toPhysicalPath(logicalPath: string): string {
    // Remove leading slash and join with basePath
    const relativePath = logicalPath.startsWith('/')
      ? logicalPath.slice(1)
      : logicalPath;
    return path.join(this.basePath, relativePath);
  }

  /**
   * Converts a physical filesystem path back to a logical path
   */
  private toLogicalPath(physicalPath: string): string {
    const relativePath = path.relative(this.basePath, physicalPath);
    return '/' + relativePath.replace(/\\/g, '/');
  }

  /**
   * Checks if a path points to a markdown file
   */
  private isMarkdownFile(logicalPath: string): boolean {
    return logicalPath.endsWith('.md') || logicalPath.endsWith('.markdown');
  }

  /**
   * Gets the readme.md path for a folder
   */
  private getFolderReadmePath(folderLogicalPath: string): string {
    return folderLogicalPath.endsWith('/')
      ? `${folderLogicalPath}readme.md`
      : `${folderLogicalPath}/readme.md`;
  }

  /**
   * Parses front matter from markdown content
   * Returns { metadata, content } where content is the body without front matter
   */
  private parseFrontMatter(content: string): { metadata: Record<string, unknown>; content: string } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      return { metadata: {}, content };
    }

    const frontMatterText = match[1];
    const bodyContent = match[2];

    try {
      const metadata = yaml.parse(frontMatterText) || {};
      return { metadata, content: bodyContent };
    } catch (error) {
      // If YAML parsing fails, return empty metadata
      console.error('Failed to parse YAML front matter:', error);
      return { metadata: {}, content: bodyContent };
    }
  }

  /**
   * Serializes metadata to front matter format
   */
  private serializeFrontMatter(metadata: Record<string, unknown>, content: string): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }

    const yamlString = yaml.stringify(metadata);
    return `---\n${yamlString}---\n${content}`;
  }

  /**
   * CENTRALIZED: Reads metadata from a node (file or folder)
   * For markdown files, extracts from front matter
   * For folders, reads from readme.md if it exists
   * For other nodes, returns empty metadata
   */
  private async readNodeMetadata(logicalPath: string, physicalPath?: string): Promise<Record<string, unknown>> {
    const actualPhysicalPath = physicalPath || this.toPhysicalPath(logicalPath);

    try {
      const stats = await fs.stat(actualPhysicalPath);

      // For folders, read metadata from readme.md
      if (stats.isDirectory()) {
        const readmePath = this.getFolderReadmePath(logicalPath);
        const readmePhysicalPath = this.toPhysicalPath(readmePath);

        try {
          const content = await fs.readFile(readmePhysicalPath, 'utf-8');
          const { metadata } = this.parseFrontMatter(content);
          return metadata;
        } catch (error) {
          // If readme.md doesn't exist, return empty metadata
          if ((error as { code: string }).code === 'ENOENT') {
            return {};
          }
          throw error;
        }
      }

      // For markdown files, extract from front matter
      if (stats.isFile() && this.isMarkdownFile(logicalPath)) {
        const content = await fs.readFile(actualPhysicalPath, 'utf-8');
        const { metadata } = this.parseFrontMatter(content);
        return metadata;
      }

      return {};
    } catch {
      // If file doesn't exist or any other error, return empty metadata
      return {};
    }
  }

  /**
   * CENTRALIZED: Writes metadata to a node
   * For markdown files, updates the front matter
   * For folders, writes to readme.md (creates if doesn't exist)
   * For other nodes, does nothing (could be extended to use .meta files)
   */
  private async writeNodeMetadata(
    logicalPath: string,
    metadata: Record<string, unknown>,
    physicalPath?: string
  ): Promise<void> {
    const actualPhysicalPath = physicalPath || this.toPhysicalPath(logicalPath);

    const stats = await fs.stat(actualPhysicalPath);

    // For folders, write metadata to readme.md
    if (stats.isDirectory()) {
      const readmePath = this.getFolderReadmePath(logicalPath);
      const readmePhysicalPath = this.toPhysicalPath(readmePath);

      let existingContent = '';
      try {
        const fullContent = await fs.readFile(readmePhysicalPath, 'utf-8');
        const { content } = this.parseFrontMatter(fullContent);
        existingContent = content;
      } catch (error) {
        // If readme.md doesn't exist, we'll create it with empty content
        if ((error as { code: string }).code !== 'ENOENT') {
          throw error;
        }
      }

      const newFullContent = this.serializeFrontMatter(metadata, existingContent);
      await fs.writeFile(readmePhysicalPath, newFullContent, 'utf-8');
      return;
    }

    // For markdown files, update the front matter
    if (stats.isFile() && this.isMarkdownFile(logicalPath)) {
      const existingContent = await fs.readFile(actualPhysicalPath, 'utf-8');
      const { content } = this.parseFrontMatter(existingContent);

      // Create new content with updated metadata
      const newFullContent = this.serializeFrontMatter(metadata, content);
      await fs.writeFile(actualPhysicalPath, newFullContent, 'utf-8');
    }
    // For non-markdown files, metadata is not stored yet
  }

  /**
   * CENTRALIZED: Builds a Node object with metadata populated
   */
  private async buildNode(logicalPath: string, physicalPath: string, stats: Stats): Promise<Node> {
    const node: Node = {
      name: logicalPath,
      type: stats.isDirectory() ? 'folder' : 'file',
    };

    // Add metadata if available
    const metadata = await this.readNodeMetadata(logicalPath, physicalPath);
    if (Object.keys(metadata).length > 0) {
      node.metadata = metadata;
    }

    return node;
  }

  /**
   * Ensures the base path exists
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async createFile(logicalPath: string): Promise<FileNode> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    // Check if already exists
    try {
      await fs.access(physicalPath);
      throw new Error(`File already exists at path: ${logicalPath}`);
    } catch (error) {
      if ((error as { code: string }).code !== 'ENOENT') {
        throw error;
      }
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(physicalPath);
    await fs.mkdir(parentDir, { recursive: true });

    // Create empty file
    await fs.writeFile(physicalPath, '', 'utf-8');

    return {
      name: logicalPath,
      type: 'file',
    };
  }

  async createFolder(logicalPath: string): Promise<FolderNode> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    // Check if already exists
    try {
      const stats = await fs.stat(physicalPath);
      if (stats.isDirectory()) {
        throw new Error(`Folder already exists at path: ${logicalPath}`);
      }
    } catch (error) {
      if ((error as { code: string }).code !== 'ENOENT') {
        throw error;
      }
    }

    // Create directory
    await fs.mkdir(physicalPath, { recursive: true });

    return {
      name: logicalPath,
      type: 'folder',
    };
  }

  async deleteNode(logicalPath: string): Promise<void> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    try {
      const stats = await fs.stat(physicalPath);

      if (stats.isDirectory()) {
        await fs.rm(physicalPath, { recursive: true, force: true });
      } else {
        await fs.unlink(physicalPath);
      }
    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        throw new Error(`Node not found at path: ${logicalPath}`);
      }
      throw error;
    }
  }

  async renameNode(oldPath: string, newPath: string): Promise<Node> {
    const oldPhysicalPath = this.toPhysicalPath(oldPath);
    const newPhysicalPath = this.toPhysicalPath(newPath);

    // Check if source exists
    let stats;
    try {
      stats = await fs.stat(oldPhysicalPath);
    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        throw new Error(`Node not found at path: ${oldPath}`);
      }
      throw error;
    }

    // Check if destination already exists
    try {
      await fs.access(newPhysicalPath);
      throw new Error(`Node already exists at destination path: ${newPath}`);
    } catch (error) {
      if ((error as { code: string }).code !== 'ENOENT') {
        throw error;
      }
    }

    // Ensure parent directory of destination exists
    const newParentDir = path.dirname(newPhysicalPath);
    await fs.mkdir(newParentDir, { recursive: true });

    // Rename/move the node
    await fs.rename(oldPhysicalPath, newPhysicalPath);

    // Use centralized buildNode to get metadata
    return this.buildNode(newPath, newPhysicalPath, stats);
  }

  async readContent(logicalPath: string): Promise<string> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    try {
      const stats = await fs.stat(physicalPath);

      // For folders, read content from readme.md
      if (stats.isDirectory()) {
        const readmePath = this.getFolderReadmePath(logicalPath);
        const readmePhysicalPath = this.toPhysicalPath(readmePath);

        try {
          const fullContent = await fs.readFile(readmePhysicalPath, 'utf-8');
          const { content } = this.parseFrontMatter(fullContent);
          return content;
        } catch (error) {
          // If readme.md doesn't exist, return empty string
          if ((error as { code: string }).code === 'ENOENT') {
            return '';
          }
          throw error;
        }
      }

      // For files
      const fullContent = await fs.readFile(physicalPath, 'utf-8');

      // For markdown files, return content without front matter
      if (this.isMarkdownFile(logicalPath)) {
        const { content } = this.parseFrontMatter(fullContent);
        return content;
      }

      return fullContent;

    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        throw new Error(`Node not found at path: ${logicalPath}`);
      }
      throw error;
    }
  }

  async writeContent(logicalPath: string, content: string): Promise<void> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    try {
      const stats = await fs.stat(physicalPath);

      // For folders, write content to readme.md
      if (stats.isDirectory()) {
        const readmePath = this.getFolderReadmePath(logicalPath);
        const readmePhysicalPath = this.toPhysicalPath(readmePath);

        const metadata = await this.readNodeMetadata(logicalPath, physicalPath);
        const newFullContent = this.serializeFrontMatter(metadata, content);
        await fs.writeFile(readmePhysicalPath, newFullContent, 'utf-8');
        return;
      }

      // For markdown files, preserve existing front matter
      if (this.isMarkdownFile(logicalPath)) {
        const metadata = await this.readNodeMetadata(logicalPath, physicalPath);
        const newFullContent = this.serializeFrontMatter(metadata, content);
        await fs.writeFile(physicalPath, newFullContent, 'utf-8');
      } else {
        await fs.writeFile(physicalPath, content, 'utf-8');
      }

    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        throw new Error(`Node not found at path: ${logicalPath}`);
      }
      throw error;
    }
  }

  async writeMetadata(logicalPath: string, metadata: Record<string, unknown>): Promise<void> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    try {
      await this.writeNodeMetadata(logicalPath, metadata, physicalPath);
    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        throw new Error(`Node not found at path: ${logicalPath}`);
      }
      throw error;
    }
  }

  async getNode(logicalPath: string): Promise<Node | null> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    try {
      const stats = await fs.stat(physicalPath);
      return this.buildNode(logicalPath, physicalPath, stats);
    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listNodes(logicalPath: string): Promise<Node[]> {
    const physicalPath = this.toPhysicalPath(logicalPath);

    try {
      const stats = await fs.stat(physicalPath);

      if (!stats.isDirectory()) {
        throw new Error(`Path points to a file, not a folder: ${logicalPath}`);
      }

      const entries = await fs.readdir(physicalPath, { withFileTypes: true });

      const nodes: Node[] = [];

      for (const entry of entries) {
        // Skip readme.md files as they represent the folder's content/metadata
        if (entry.name === 'readme.md') {
          continue;
        }

        const entryLogicalPath = logicalPath.endsWith('/')
          ? `${logicalPath}${entry.name}`
          : `${logicalPath}/${entry.name}`;

        const entryPhysicalPath = path.join(physicalPath, entry.name);
        const entryStats = await fs.stat(entryPhysicalPath);

        // Use centralized buildNode
        const node = await this.buildNode(entryLogicalPath, entryPhysicalPath, entryStats);
        nodes.push(node);
      }

      return nodes;
    } catch (error) {
      if ((error as { code: string }).code === 'ENOENT') {
        throw new Error(`Folder not found at path: ${logicalPath}`);
      }
      throw error;
    }
  }
}