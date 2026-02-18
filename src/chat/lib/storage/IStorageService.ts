import { FileNode, FolderNode, Node } from '@/types/nodes';

export interface IStorageService {

  initialize(): Promise<void>;

  /**
   * Creates a new file node at the specified path
   * @param path - Absolute path including the file name (e.g., '/documents/file.txt')
   * @throws Error if the file already exists or parent folder doesn't exist
   */
  createFile(path: string): Promise<FileNode>;

  /**
   * Creates a new folder node at the specified path
   * @param path - Absolute path including the folder name (e.g., '/documents/projects')
   * @throws Error if the folder already exists or parent folder doesn't exist
   */
  createFolder(path: string): Promise<FolderNode>;

  /**
   * Deletes a file or folder at the specified path
   * @param path - Absolute path of the node to delete
   * @throws Error if the node doesn't exist
   */
  deleteNode(path: string): Promise<void>;

  /**
   * Renames and/or moves a node to a new path
   * @param oldPath - Current absolute path of the node
   * @param newPath - New absolute path for the node
   * @returns The updated node with the new path
   * @throws Error if the source node doesn't exist, destination already exists, or parent folder doesn't exist
   */
  renameNode(oldPath: string, newPath: string): Promise<Node>;

  /**
   * Reads the content of a file
   * @param path - Absolute path of the file
   * @returns The file content as a string
   * @throws Error if the file doesn't exist or path points to a folder
   */
  readContent(path: string): Promise<string>;

  /**
   * Writes content to a file
   * @param path - Absolute path of the file
   * @param content - Content to write to the file
   * @throws Error if the file doesn't exist or path points to a folder
   */
  writeContent(path: string, content: string): Promise<void>;

  /**
   * Writes the metadata for a node (file or folder)
   * @param path - Absolute path of the file
   * @param metadata - A name/value pairs to write
   * @throws Error if the file or folder doesn't exist
   */
  writeMetadata(path: string, metadata: Record<string, unknown>): Promise<void>;

  /**
   * Gets a node (file or folder) at the specified path
   * @param path - Absolute path of the node
   * @returns The node if it exists, null otherwise
   */
  getNode(path: string): Promise<Node | null>;

  /**
   * Lists all nodes in a folder
   * @param path - Absolute path of the folder
   * @returns Array of nodes in the folder
   * @throws Error if the path doesn't exist or points to a file
   */
  listNodes(path: string): Promise<Node[]>;

}
