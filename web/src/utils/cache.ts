import { updateStorageEstimate } from '@/store';
import type { ClassStruct } from '@android-cs/api-parser';
import lf from 'localforage';

const encoder = new TextEncoder();
const NETWORK_RETRY_COUNT = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 300;

async function sha256Hash(str: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return new Uint8Array(hashBuffer)
    .slice(0, 12)
    .toBase64({ alphabet: 'base64url', omitPadding: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchTextWithRetry = async (url: string): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(url);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === NETWORK_RETRY_COUNT) break;
      await sleep(NETWORK_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Fetch failed for ${url}`);
};

const dbNames: string[] = [];
const createDB = (name: string) => {
  dbNames.push(name);
  return lf.createInstance({ name });
};

const persistentCache = createDB('persistentCacheV2');

const getPersistentCache = async (
  key: string,
  fallback: () => Promise<string>,
) => {
  let value = await persistentCache.getItem<string>(key);
  if (!value) {
    value = await fallback();
    await persistentCache.setItem(key, value);
    updateStorageEstimate();
  }
  return value;
};

interface UrlCacheKeyBuilder {
  (url: string): string;
}

export const persistentFetch = async (
  url: string,
  cacheKeyBuilder?: UrlCacheKeyBuilder,
): Promise<string> => {
  const key = await sha256Hash(cacheKeyBuilder?.(url) ?? url);
  return getPersistentCache(key, () => fetchTextWithRetry(url));
};

const structCache = createDB('structCacheV9');

export const getOrSetStructCache = async (
  filePath: string,
  fallback: () => Promise<ClassStruct[]>,
): Promise<ClassStruct[]> => {
  const key = await sha256Hash(filePath);
  let value = await structCache.getItem<ClassStruct[]>(key);
  if (!value) {
    value = await fallback();
    await structCache.setItem(key, value);
    updateStorageEstimate();
  }
  return value;
};

export const check404File = async (filePath: string): Promise<boolean> => {
  const key = await sha256Hash(filePath);
  const value = await persistentCache.getItem<string>(key);
  return !!value && value.startsWith('404:');
};

export const clearLocalCache = async () => {
  await Promise.all(
    dbNames.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => resolve();
        }),
    ),
  );
  await updateStorageEstimate();
};

// delete unused databases
indexedDB.databases().then((dbs) => {
  dbs.forEach((db) => {
    if (!dbNames.includes(db.name!)) {
      indexedDB.deleteDatabase(db.name!);
    }
  });
});
