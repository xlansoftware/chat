import { updateFolderSummary } from '@/lib-server/folder-summary';
import { IStorageService } from '@/lib/storage/IStorageService';
import { StorageServiceFactory } from '@/lib/storage/StorageServiceFactory';

// Cache the storage service instance
const storageService: Map<string, IStorageService> = new Map<string, IStorageService>();

const debug_session = false;

const colors = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function colorize(text: string, color: keyof typeof colors) {
  return colors[color] + text + colors.reset;
}

export function clearStorage(sessionId: string) {
  if (!storageService.has(sessionId)) {
    return;
  }
  if (debug_session) console.log(colorize(`[${sessionId}] delete`, "red"));
  storageService.delete(sessionId);
}

export async function getStorage(sessionId: string): Promise<IStorageService> {
  if (debug_session) console.log(colorize(`[${sessionId}] get`, "yellow"));
  if (!storageService.has(sessionId)) {
    if (debug_session) console.log(colorize(`[${sessionId}] create`, "red"));

    const type = sessionId === "default"
      ? undefined // will read from environment varaible
      : "memory" // sessionId is used for test isolation. yeah, maybe the term "sessionId" is not correct :)
      ;

    const storage = await StorageServiceFactory.createInstance(type);

    if (false) {
      // tidy up it there was a change in the summary algorithm
      console.log(`Updating all summaries and file/folder names ...`);
      await updateFolderSummary(storage, "/", true, true);
    }

    storageService.set(
      sessionId,
      storage
    );
  }
  return storageService.get(sessionId)!;
}