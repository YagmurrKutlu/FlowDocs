import type { QueryClient } from '@tanstack/react-query';

const PRESERVED_LOCAL_STORAGE_KEYS = new Set(['flowdocs-auth']);

function isFlowDocsStorageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.startsWith('flowdocs') ||
    lower.includes('flowdocs') ||
    lower.startsWith('fd-')
  );
}

function collectRemovableKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (storage === localStorage && PRESERVED_LOCAL_STORAGE_KEYS.has(key)) {
      continue;
    }
    if (isFlowDocsStorageKey(key)) {
      keys.push(key);
    }
  }
  return keys;
}

async function clearMatchingIndexedDatabases(): Promise<number> {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
    return 0;
  }

  let removed = 0;
  try {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      const name = db.name ?? '';
      if (!name) continue;
      if (/flowdocs|yjs|lexical/i.test(name)) {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        });
        removed += 1;
      }
    }
  } catch {
    // ignore — optional cleanup
  }
  return removed;
}

export type ClearLocalCacheResult = {
  clearedCount: number;
  errors: string[];
};

export async function clearFlowDocsLocalCache(
  queryClient?: QueryClient,
): Promise<ClearLocalCacheResult> {
  const errors: string[] = [];
  let clearedCount = 0;

  for (const storage of [localStorage, sessionStorage]) {
    if (typeof window === 'undefined') break;
    try {
      const keys = collectRemovableKeys(storage);
      for (const key of keys) {
        storage.removeItem(key);
        clearedCount += 1;
      }
    } catch {
      errors.push('Tarayıcı depolaması temizlenemedi.');
    }
  }

  try {
    clearedCount += await clearMatchingIndexedDatabases();
  } catch {
    errors.push('IndexedDB temizlenemedi.');
  }

  if (queryClient) {
    try {
      await queryClient.invalidateQueries();
    } catch {
      errors.push('Önbellek yenilemesi tamamlanamadı.');
    }
  }

  return { clearedCount, errors };
}
