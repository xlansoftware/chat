import { FileNode, FolderNode, Node } from '@/types/nodes';
import { IStorageService } from './IStorageService';
import { logger } from './../../lib-server/logger';
import yaml from 'yaml';

export class MemoryStorageService implements IStorageService {
  private nodes: Map<string, Node>;
  private fileContents: Map<string, string>;

  constructor() {
    this.nodes = new Map();
    this.fileContents = new Map();
    this.nodes.set('/', { name: '/', type: 'folder' });

    logger.debug('MemoryStorageService initialized');
  }

  private normalizePath(path: string): string {
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  }

  private isMarkdownFile(path: string): boolean {
    return path.endsWith('.md') || path.endsWith('.markdown');
  }

  private parseFrontMatter(
    content: string
  ): { metadata: Record<string, unknown>; content: string } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      return { metadata: {}, content };
    }

    try {
      const metadata = yaml.parse(match[1]) || {};
      return { metadata, content: match[2] };
    } catch (error) {
      logger.warn('Failed to parse YAML front matter', {
        error,
        preview: match[1].slice(0, 200),
      });
      return { metadata: {}, content: match[2] };
    }
  }

  private serializeFrontMatter(
    metadata: Record<string, unknown>,
    content: string
  ): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }

    return `---\n${yaml.stringify(metadata)}---\n${content}`;
  }

  private getParentPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === '/') return '/';
    const i = normalized.lastIndexOf('/');
    return i === 0 ? '/' : normalized.slice(0, i);
  }

  private async ensureParentExists(path: string): Promise<void> {
    const parentPath = this.getParentPath(path);
    if (parentPath === '/' || parentPath === path) return;

    if (!this.nodes.has(parentPath)) {
      await this.ensureParentExists(parentPath);
      this.nodes.set(parentPath, { name: parentPath, type: 'folder' });
      logger.debug('Parent folder auto-created', { path: parentPath });
    }
  }

  private getDescendantPaths(path: string): string[] {
    const normalized = this.normalizePath(path);
    return [...this.nodes.keys()].filter(
      p => p !== normalized && p.startsWith(normalized + '/')
    );
  }

  private updateNodeMetadata(
    path: string,
    metadata: Record<string, unknown>
  ): void {
    const node = this.nodes.get(path);
    if (!node) return;

    if (Object.keys(metadata).length > 0) {
      node.metadata = metadata;
    } else {
      delete node.metadata;
    }
  }

  async initialize(): Promise<void> {
    logger.debug('MemoryStorageService.initialize called (noop)');
  }

  async createFile(path: string): Promise<FileNode> {
    const p = this.normalizePath(path);

    if (this.nodes.has(p)) {
      logger.warn('createFile: already exists', { path: p });
      throw new Error(`File already exists at path: ${path}`);
    }

    await this.ensureParentExists(p);

    const node: FileNode = { name: p, type: 'file' };
    this.nodes.set(p, node);
    this.fileContents.set(p, '');

    logger.debug('File created', { path: p });
    return node;
  }

  async createFolder(path: string): Promise<FolderNode> {
    const p = this.normalizePath(path);

    if (this.nodes.has(p)) {
      logger.warn('createFolder: already exists', { path: p });
      throw new Error(`Folder already exists at path: ${path}`);
    }

    await this.ensureParentExists(p);

    const node: FolderNode = { name: p, type: 'folder' };
    this.nodes.set(p, node);

    logger.debug('Folder created', { path: p });
    return node;
  }

  async deleteNode(path: string): Promise<void> {
    const p = this.normalizePath(path);

    const node = this.nodes.get(p);
    if (!node) {
      logger.error('deleteNode: not found', { path: p });
      throw new Error(`Node not found at path: ${path}`);
    }

    let deleted = 1;

    if (node.type === 'folder') {
      const descendants = this.getDescendantPaths(p);
      deleted += descendants.length;

      for (const d of descendants) {
        this.nodes.delete(d);
        this.fileContents.delete(d);
      }
    }

    this.nodes.delete(p);
    this.fileContents.delete(p);

    logger.debug('Node deleted', {
      path: p,
      type: node.type,
      deletedCount: deleted,
    });
  }

  async renameNode(oldPath: string, newPath: string): Promise<Node> {
    const from = this.normalizePath(oldPath);
    const to = this.normalizePath(newPath);

    const node = this.nodes.get(from);
    if (!node) {
      logger.error('renameNode: source not found', { from });
      throw new Error(`Node not found at path: ${oldPath}`);
    }

    if (this.nodes.has(to)) {
      logger.warn('renameNode: destination exists', { from, to });
      throw new Error(`Node already exists at destination path: ${newPath}`);
    }

    logger.debug('Renaming node', { from, to, type: node.type });

    await this.ensureParentExists(to);

    const newNode: Node = {
      name: to,
      type: node.type,
      metadata: node.metadata,
    };

    if (node.type === 'file') {
      const content = this.fileContents.get(from) || '';
      this.fileContents.set(to, content);
      this.fileContents.delete(from);
    }

    if (node.type === 'folder') {
      for (const d of this.getDescendantPaths(from)) {
        const rel = d.slice(from.length);
        const nd = to + rel;
        const dn = this.nodes.get(d)!;

        this.nodes.set(nd, {
          name: nd,
          type: dn.type,
          metadata: dn.metadata,
        });

        if (dn.type === 'file') {
          this.fileContents.set(nd, this.fileContents.get(d)!);
          this.fileContents.delete(d);
        }

        this.nodes.delete(d);
      }
    }

    this.nodes.set(to, newNode);
    this.nodes.delete(from);

    return newNode;
  }

  async readContent(path: string): Promise<string> {
    const p = this.normalizePath(path);
    const node = this.nodes.get(p);

    if (!node) {
      logger.error('readContent: not found', { path: p });
      throw new Error(`Node not found at path: ${path}`);
    }

    const raw = this.fileContents.get(p) || '';

    if (this.isMarkdownFile(p)) {
      const { content } = this.parseFrontMatter(raw);
      logger.debug('readContent (markdown)', { path: p, length: content.length });
      return content;
    }

    logger.debug('readContent', { path: p, length: raw.length });
    return raw;
  }

  async writeContent(path: string, content: string): Promise<void> {
    const p = this.normalizePath(path);
    const node = this.nodes.get(p);

    if (!node) {
      logger.error('writeContent: not found', { path: p });
      throw new Error(`Node not found at path: ${path}`);
    }

    logger.debug('writeContent', {
      path: p,
      length: content.length,
      markdown: this.isMarkdownFile(p),
    });

    if (this.isMarkdownFile(p)) {
      const existing = this.fileContents.get(p) || '';
      const { metadata } = this.parseFrontMatter(existing);
      this.fileContents.set(p, this.serializeFrontMatter(metadata, content));
    } else {
      this.fileContents.set(p, content);
    }
  }

  async writeMetadata(path: string, metadata: Record<string, unknown>): Promise<void> {
    const p = this.normalizePath(path);
    const node = this.nodes.get(p);

    if (!node) {
      logger.error('writeMetadata: not found', { path: p });
      throw new Error(`Node not found at path: ${path}`);
    }

    logger.debug('writeMetadata', { path: p, keys: Object.keys(metadata) });

    if (node.type === 'file' && this.isMarkdownFile(p)) {
      const existing = this.fileContents.get(p) || '';
      const { content } = this.parseFrontMatter(existing);
      this.fileContents.set(p, this.serializeFrontMatter(metadata, content));
    }

    this.updateNodeMetadata(p, metadata);
  }

  async getNode(path: string): Promise<Node | null> {
    const p = this.normalizePath(path);
    const node = this.nodes.get(p);

    logger.debug('getNode', { path: p });

    if (!node) return null;

    if (node.type === 'file' && this.isMarkdownFile(p)) {
      const { metadata } = this.parseFrontMatter(this.fileContents.get(p) || '');
      return { ...node, metadata: Object.keys(metadata).length ? metadata : undefined };
    }

    return node;
  }

  async listNodes(path: string): Promise<Node[]> {
    const p = this.normalizePath(path);
    const node = this.nodes.get(p);

    if (!node || node.type !== 'folder') {
      logger.error('listNodes: invalid folder', { path: p });
      throw new Error(`Folder not found at path: ${path}`);
    }

    logger.debug('listNodes', { path: p });

    const prefix = p === '/' ? '/' : p + '/';
    const children: Node[] = [];

    for (const [np, nv] of this.nodes) {
      if (np.startsWith(prefix) && np !== p && !np.slice(prefix.length).includes('/')) {
        if (nv.type === 'file' && this.isMarkdownFile(np)) {
          const { metadata } = this.parseFrontMatter(this.fileContents.get(np) || '');
          children.push({ ...nv, metadata });
        } else {
          children.push(nv);
        }
      }
    }

    return children;
  }

  clear(): void {
    this.nodes.clear();
    this.fileContents.clear();
    this.nodes.set('/', { name: '/', type: 'folder' });
    logger.debug('Storage cleared');
  }

  getAllNodes(): Map<string, Node> {
    return new Map(this.nodes);
  }

  getSize(): { nodeCount: number; totalContentSize: number } {
    let total = 0;
    for (const c of this.fileContents.values()) total += c.length;

    return { nodeCount: this.nodes.size, totalContentSize: total };
  }
}
