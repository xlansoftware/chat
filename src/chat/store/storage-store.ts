/* eslint-disable @typescript-eslint/no-explicit-any */
// store/storage-store.ts
import { create } from 'zustand';
import { storageClient } from '@/lib/storage-client';
import type { Node } from '@/types/nodes';
import { generateFileName } from '@/lib/file-name';

interface StorageState {
  // State
  currentFolder: string;
  selectedFile: string | null;
  currentFolderContent: Node[];
  breadcrumbs: Node[] | null;
  isLoading: boolean;
  error: string | null;

  // Navigation actions
  setCurrentFolder: (path: string) => Promise<void>;
  navigateToFolder: (path: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  navigateToBreadcrumb: (path: string) => Promise<void>;

  // Selection actions
  setSelectedFile: (path: string | null) => Promise<void>;

  // Content management
  refreshCurrentFolder: () => Promise<void>;

  // File/Folder operations
  createNodeWithTitle: <T extends Node>(nodeType: T['type'], title: string, inFolder: string) => Promise<T>;
  createNode: <T extends Node>(nodeType: T['type'], path: string, metadata: Record<string, unknown>) => Promise<T>;
  deleteNode: (path: string) => Promise<void>;
  moveNode: (oldPath: string, newPath: string) => Promise<Node | null>;

  writeNodeMetadata: <T extends Node>(node: T, metadata: Record<string, unknown>) => Promise<T>;

  // File content operations
  readContent: (path: string) => Promise<string>;
  writeContent: (path: string, content: string) => Promise<void>;

  // Node queries
  getNode: (path: string) => Promise<Node | null>;
  listNodes: (path: string) => Promise<{ nodes: Node[], breadcrumbs: Node[] }>;

  // Title update:
  // this method updates the UI state only - since the change of the title
  // is saved in the metadata and also changes the node name, and
  // the title is updaetd frequently during the first time generation,
  // it is separate in two parts: only the UI state here and persistant update
  // after the generation is done.
  updateTitle: (path: string, title: string) => void;

  // Utility actions
  clearError: () => void;
  reset: () => void;
  getNodeDisplayNameByPath: (fullPath: string) => string;
}

const getNameFromPath = (path: string): string => {
  if (path === '/') return '';
  const normalized = path.endsWith('/') ? path.slice(0, -1) : path;
  const lastSlashIndex = normalized.lastIndexOf('/');
  return normalized.slice(lastSlashIndex + 1);
};

const getParentPath = (path: string): string => {
  if (path === '/') return '/';
  const normalized = path.endsWith('/') ? path.slice(0, -1) : path;
  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex === 0 ? '/' : normalized.slice(0, lastSlashIndex);
};

const initialState = {
  currentFolder: '/',
  selectedFile: null,
  currentFolderContent: [],
  breadcrumbs: null,
  isLoading: false,
  error: null,
};

export const useStorageStore = create<StorageState>((set, get) => ({
  ...initialState,

  // Navigation actions
  setCurrentFolder: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const { nodes, breadcrumbs } = await storageClient.listNodes(path);

      set({
        currentFolder: path,
        currentFolderContent: nodes,
        breadcrumbs,
        selectedFile: null,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to set current folder',
        isLoading: false,
      });
      throw error;
    }
  },

  navigateToFolder: async (path: string) => {
    await get().setCurrentFolder(path);
  },

  navigateUp: async () => {
    const currentFolder = get().currentFolder;
    if (currentFolder === '/') return;

    const parentPath = getParentPath(currentFolder);
    await get().setCurrentFolder(parentPath);
  },

  navigateToBreadcrumb: async (path: string) => {
    await get().setCurrentFolder(path);
  },

  // Selection actions
  setSelectedFile: async (path: string | null) => {
    if (!path) return set({ selectedFile: path });

    const folder = getParentPath(path);
    if (folder === get().currentFolder) return set({ selectedFile: path });

    await get().setCurrentFolder(folder);
    set({ selectedFile: path });

  },

  // Content management
  refreshCurrentFolder: async () => {
    const currentFolder = get().currentFolder;
    await get().setCurrentFolder(currentFolder);
  },

  createNodeWithTitle: async <T extends Node>(nodeType: T['type'], title: string, inFolder: string) => {
    const { currentFolder, currentFolderContent } = get();

    const folderContent = inFolder === currentFolder
      ? currentFolderContent
      : (await storageClient.listNodes(inFolder)).nodes;

    const fileNumber = folderContent.reduce((prev, c) => {
      if (c.type !== nodeType) return prev;
      const n = parseInt(getNameFromPath(c.name));
      return isNaN(n) ? prev : Math.max(n, prev);
    }, 0);

    const fileName = generateFileName(fileNumber + 1, title) + (nodeType === "file" ? ".md" : "");
    const filePath = inFolder === '/' ? `/${fileName}` : `${inFolder}/${fileName}`;

    return await get().createNode(nodeType, filePath, { title });
  },

  createNode: async <T extends Node>(nodeType: T['type'], path: string, metadata: Record<string, unknown>) => {
    set({ isLoading: true, error: null });
    try {
      const node = await storageClient.createNode(nodeType, path, metadata);

      // Refresh current folder if the file is in it
      const parentPath = getParentPath(path);
      if (parentPath === get().currentFolder) {
        await get().refreshCurrentFolder();
      }

      set({ isLoading: false });
      return node;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to create file',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteNode: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      await storageClient.deleteNode(path);

      // Clear selection if deleted node was selected
      if (get().selectedFile === path) {
        set({ selectedFile: null });
      }

      // Refresh current folder if the deleted node was in it
      const parentPath = getParentPath(path);
      if (parentPath === get().currentFolder) {
        await get().refreshCurrentFolder();
      }

      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to delete node',
        isLoading: false,
      });
      throw error;
    }
  },

  moveNode: async (oldPath: string, newPath: string) => {
    set({ isLoading: true, error: null });
    try {
      let result: Node | null = null;
      try {
        result = await storageClient.renameNode(oldPath, newPath);
      } catch {
        // may already been renamed
        return null;
      }

      set((state) => ({
        isLoading: false,

        selectedFile: state.selectedFile === oldPath
          ? newPath
          : state.selectedFile,

        currentFolderContent: state.currentFolderContent.map((node) =>
          node.name === oldPath
            ? { ...node, name: newPath }
            : node
        ),

        breadcrumbs: (state.breadcrumbs || []).map((node) =>
          node.name === oldPath
            ? { ...node, name: newPath }
            : node
        ),
      }));

      return result;

    } catch (error: any) {
      set({
        error: error.message || 'Failed to rename node',
        isLoading: false,
      });
      throw error;
    }
  },

  writeNodeMetadata: async <T extends Node>(node: T, metadata: Record<string, unknown>) => {
    set({ isLoading: true, error: null });
    try {
      const path = node.name;
      await storageClient.writeMetadata(path, metadata);

      set((state) => ({
        isLoading: false,
        currentFolderContent: state.currentFolderContent.map((node) =>
          node.name === path
            ? {
              ...node,
              metadata
            }
            : node
        ),

        breadcrumbs: (state.breadcrumbs || []).map((node) =>
          node.name === path
            ? {
              ...node,
              metadata
            }
            : node
        ),
      }));
      return node;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to rename node',
        isLoading: false,
      });
      throw error;
    }
  },

  // File content operations
  readContent: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const content = await storageClient.readContent(path);
      set({ isLoading: false });
      return content;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to read content',
        isLoading: false,
      });
      throw error;
    }
  },

  writeContent: async (path: string, content: string) => {
    set({ isLoading: true, error: null });
    try {
      await storageClient.writeContent(path, content);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to write content',
        isLoading: false,
      });
      throw error;
    }
  },

  // Node queries
  getNode: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const node = await storageClient.getNode(path);
      set({ isLoading: false });
      return node;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to get node',
        isLoading: false,
      });
      throw error;
    }
  },

  listNodes: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await storageClient.listNodes(path);
      set({ isLoading: false });
      return result;
    } catch (error: any) {
      set({
        error: error.message || 'Failed to list nodes',
        isLoading: false,
      });
      throw error;
    }
  },

  updateTitle: (path: string, title: string) => {
    set((state) => ({
      currentFolderContent: state.currentFolderContent.map((node) =>
        node.name === path
          ? {
            ...node,
            metadata: {
              ...(node.metadata || {}),
              title,
            }
          }
          : node
      ),

      breadcrumbs: (state.breadcrumbs || []).map((node) =>
        node.name === path
          ? {
            ...node,
            metadata: {
              ...(node.metadata || {}),
              title,
            }
          }
          : node
      ),
    }));
  },

  // Utility actions
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },

  getNodeDisplayNameByPath: (fullPath: string): string => {
    const node = get().currentFolderContent.find((n) => n.name === fullPath);
    if (node?.metadata?.title) return `${node?.metadata?.title}`;
    return fullPath.split('/').pop() || fullPath;
  },
}));