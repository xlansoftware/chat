import fs from 'fs/promises';
import path from 'path';

export const rootStorePath = process.env.DATA_STORE_PATH || '/data';
export const rootConfigPath = process.env.CONFIG_PATH || '/config';

/**
 * Creates a folder/directory at the specified path if it doesn't exist
 * @param folderPath - The path of the folder to create
 * @param options - Configuration options
 * @returns The resolved absolute path of the folder
 * @throws {Error} If folder creation fails
 */
export async function ensureFolderExists(
  folderPath: string,
  options?: {
    /**
     * Whether to create parent directories recursively
     * @default true
     */
    recursive?: boolean;
    /**
     * File system mode (permissions) for the created folder
     * @default 0o755 (read/write/execute for owner, read/execute for group/others)
     */
    mode?: string | number;
    /**
     * Base directory to resolve relative paths against
     * @default process.cwd()
     */
    baseDir?: string;
    /**
     * Whether to throw an error if the path exists as a file
     * @default true
     */
    throwIfFile?: boolean;
  }
): Promise<string> {
  const {
    recursive = true,
    mode = 0o755,
    baseDir = process.cwd(),
    throwIfFile = true,
  } = options || {};

  try {
    // Resolve the absolute path
    const absolutePath = path.isAbsolute(folderPath)
      ? folderPath
      : path.resolve(baseDir, folderPath);

    try {
      // Check if folder already exists using async stat
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        return absolutePath;
      }

      if (stats.isFile() && throwIfFile) {
        throw new Error(`Path exists but is a file, not a directory: ${absolutePath}`);
      }

      // If it's neither a file nor directory (e.g., symbolic link, socket, etc.)
      if (throwIfFile) {
        throw new Error(`Path exists but is not a directory: ${absolutePath}`);
      }

    } catch (error) {
      // If the error is ENOENT (file/folder doesn't exist), proceed to create it
      if ((error as { code: string }).code !== 'ENOENT') {
        throw error;
      }
    }

    // Create the folder with all parent directories
    await fs.mkdir(absolutePath, {
      recursive,
      mode,
    });

    console.log(`✅ Folder created: ${absolutePath}`);
    return absolutePath;
  } catch (error) {
    // Improve error messages with more context
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('not a directory') || error.message.includes('is a file')) {
        throw new Error(`Cannot create folder - path exists as a file: ${folderPath}`);
      }

      // Check for permission errors
      if (error.message.includes('EACCES') || error.message.includes('permission')) {
        throw new Error(`Permission denied creating folder: ${folderPath}. Check your file permissions.`);
      }

      // Check for invalid path characters
      if (error.message.includes('ENOENT') || error.message.includes('invalid path')) {
        // If recursive creation failed, it might be due to invalid characters
        const hasInvalidChars = /[<>:"|?*]/.test(folderPath);
        if (hasInvalidChars) {
          throw new Error(`Invalid folder path: ${folderPath}. Path contains invalid characters: < > : " | ? *`);
        }
        throw new Error(`Invalid folder path: ${folderPath}. Parent directory may not exist or path is malformed.`);
      }

      // Handle case where parent directories don't exist when recursive=false
      if (error.message.includes('ENOENT') && !recursive) {
        throw new Error(`Parent directories do not exist for: ${folderPath}. Use recursive: true to create them.`);
      }
    }

    // Re-throw with more context
    throw new Error(`Failed to create folder "${folderPath}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates multiple folders in parallel or sequence
 */
export async function ensureFoldersExist(
  folderPaths: string[],
  options?: Parameters<typeof ensureFolderExists>[1],
  parallel: boolean = false
): Promise<string[]> {
  if (parallel) {
    // Create all folders in parallel
    const promises = folderPaths.map(folderPath =>
      ensureFolderExists(folderPath, options)
    );
    return Promise.all(promises);
  } else {
    // Create folders sequentially
    const createdPaths: string[] = [];

    for (const folderPath of folderPaths) {
      const createdPath = await ensureFolderExists(folderPath, options);
      createdPaths.push(createdPath);
    }

    return createdPaths;
  }
}

/**
 * Creates a folder with a timestamp for unique naming
 * @param basePath - Base directory for the folder
 * @param prefix - Optional prefix for the folder name
 * @param options - Additional options for folder creation
 * @returns Path of the created folder
 */
export async function createTimestampedFolder(
  basePath: string,
  prefix?: string,
  options?: Parameters<typeof ensureFolderExists>[1]
): Promise<string> {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .split('.')[0];

  const folderName = prefix
    ? `${prefix}_${timestamp}`
    : timestamp;

  const fullPath = path.join(basePath, folderName);

  return ensureFolderExists(fullPath, options);
}

/**
 * Checks if a folder exists and is accessible
 * @param folderPath - Path to check
 * @returns True if folder exists and is accessible, false otherwise
 */
export async function folderExists(folderPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(folderPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Creates a temporary folder in the system's temp directory
 * @param prefix - Prefix for the folder name
 * @returns Path to the created temporary folder
 */
export async function createTempFolder(prefix?: string): Promise<string> {
  const os = await import('os');
  const tempDir = os.tmpdir();

  const uniqueId = Math.random().toString(36).substring(2, 15);
  const folderName = prefix ? `${prefix}_${uniqueId}` : uniqueId;
  const tempPath = path.join(tempDir, folderName);

  return ensureFolderExists(tempPath);
}

/**
 * Creates a folder and returns a cleanup function
 * Useful for temporary folders that need cleanup
 */
export async function createFolderWithCleanup(
  folderPath: string,
  options?: Parameters<typeof ensureFolderExists>[1]
): Promise<{
  path: string;
  cleanup: () => Promise<void>;
}> {
  const createdPath = await ensureFolderExists(folderPath, options);

  return {
    path: createdPath,
    cleanup: async () => {
      try {
        await fs.rm(createdPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup folder ${createdPath}:`, error);
      }
    }
  };
}

/**
 * Safely combines multiple folder paths into a single path
 */
export function combineFolderPaths(...segments: string[]): string {
  // Filter out empty segments and normalize the path
  const filteredSegments = segments.filter(segment =>
    segment && typeof segment === 'string' && segment.trim() !== ''
  );

  if (filteredSegments.length === 0) {
    return '';
  }

  // Join and normalize the path
  const combined = path.join(...filteredSegments);

  // Remove trailing slash for consistency
  return combined.replace(/[\/\\]$/, '');
}

/**
 * WriteAllText equivalent - writes text to a file, creating it if it doesn't exist
 * @param filePath - Path to the file
 * @param content - Content to write
 * @param encoding - File encoding (default: 'utf-8')
 */
export async function writeAllText(
  filePath: string,
  content: string,
  encoding: BufferEncoding = 'utf-8'
): Promise<void> {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file with specified encoding
    await fs.writeFile(filePath, content, { encoding });
  } catch (error) {
    throw new Error(`Failed to write to file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class File {
  /**
   * WriteAllText equivalent
   */
  static async writeAllText(
    path: string,
    contents: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<void> {
    return writeAllText(path, contents, encoding);
  }

  // return all folders and files with a root path
  static async lsla(rootPath: string): Promise<string[]> {
    const results: string[] = [];
    const resolvedRoot = path.resolve(rootPath);

    async function walk(currentPath: string): Promise<void> {
      let entries;
      try {
        entries = await fs.readdir(currentPath, { withFileTypes: true });
      } catch (err) {
        // If a directory cannot be read (permissions, etc.), fail fast
        throw err;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        results.push(fullPath);

        if (entry.isDirectory()) {
          await walk(fullPath);
        }
      }
    }

    // Include the root itself if desired
    results.push(resolvedRoot);
    await walk(resolvedRoot);

    return results.map((p) => `\$${p.substring(rootPath.length)}`);
  }

  /**
   * AppendAllText equivalent
   */
  static async appendAllText(
    fullPath: string,
    contents: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<void> {
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.appendFile(fullPath, contents, { encoding });
  }

  /**
   * ReadAllText equivalent
   */
  static async readAllText(
    path: string,
    encoding: BufferEncoding = 'utf-8'
  ): Promise<string> {
    return fs.readFile(path, { encoding });
  }

  /**
   * Exists equivalent
   */
  static async exists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isFile() || stats.isDirectory();
    } catch (err) {
      if ((err as { code: string }).code === 'ENOENT') return false; // Path does not exist
      throw err; // Re-throw other errors (e.g., permission issues)
    }
  }

  /**
   * Delete equivalent
   */
  static async delete(path: string): Promise<void> {
    await fs.unlink(path);
  }

  /**
   * Copy equivalent
   */
  static async copy(
    sourceFileName: string,
    destFileName: string,
    overwrite: boolean = false
  ): Promise<void> {
    if (!overwrite && await this.exists(destFileName)) {
      throw new Error(`File already exists: ${destFileName}`);
    }

    await fs.copyFile(sourceFileName, destFileName);
  }

  /**
   * Move equivalent
   */
  static async move(
    sourceFileName: string,
    destFileName: string,
    overwrite: boolean = false
  ): Promise<void> {
    if (!overwrite && await this.exists(destFileName)) {
      throw new Error(`File already exists: ${destFileName}`);
    }

    await fs.rename(sourceFileName, destFileName);
  }

  /**
 * Get names of all direct subdirectories in a folder
 * @param folderPath - Path to the folder
 * @returns Array of directory names
 */
  static async getDirectoryNames(folderPath: string): Promise<string[]> {
    try {
      // Read all entries in the directory
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      // Filter to only directories
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      return directories;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Folder does not exist: ${folderPath}`);
      }
      throw new Error(`Failed to read directory ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

  }
}