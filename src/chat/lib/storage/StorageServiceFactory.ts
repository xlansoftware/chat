import { rootStorePath } from '@/lib-server/store-tools';
import { FileSystemStorageService } from './FileSystemStorageService';
import { IStorageService } from './IStorageService';
import { MemoryStorageService } from './MemoryStorageService';

/**
 * Factory class to create storage service instances
 */
export class StorageServiceFactory {
  /**
   * Create the storage service instance
   */
  static async createInstance(type?: "filesystem" | "memory"): Promise<IStorageService> {
    let result: IStorageService;

    const storageType = type || process.env.STORAGE_TYPE || 'memory';

    switch (storageType) {
      case 'memory':
        console.log('-- Using Memory Storage Service');
        result = new MemoryStorageService();
        break;

      case 'filesystem':
        const dataDir = rootStorePath || './data';
        console.log(`-- Using File System Storage Service at ${dataDir}`);
        result = new FileSystemStorageService(dataDir);
        break;

      default:
        throw new Error(`Unknown storage type: ${storageType}`);
    }

    await result.initialize();
    return result;
  }
}