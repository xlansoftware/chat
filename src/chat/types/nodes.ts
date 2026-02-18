export type FileNode = {
  name: string;
  type: 'file';
  metadata?: Record<string, unknown>;
};

export type FolderNode = {
  name: string;
  type: 'folder';
  metadata?: Record<string, unknown>;
};

export type Node = FileNode | FolderNode;

export type CreateFileInput = {
  name: string;
  content: string;
};
