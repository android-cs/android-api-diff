import type { ApiFile } from '@android-cs/api-parser';
import {
  readCacheValue,
  writeCacheBytesIfAvailable,
} from './cache/binaryCache';
import { decodeText, encodeText, sha256String } from './cache/compression';
import {
  NETWORK_RETRY_BASE_DELAY_MS,
  NETWORK_RETRY_COUNT,
  STRUCT_DOMAIN,
  TEXT_DOMAIN,
} from './cache/config';
import { resetCacheDatabases } from './cache/database';
import {
  broadcastCacheReset,
  getCacheEpoch,
  getLogicalFlight,
  invalidateLocalFlights,
  runSingleFlight,
  setExternalResetHandler,
} from './cache/flights';
import { updateStorageEstimate } from './storageEstimate';

interface UrlCacheKeyBuilder {
  (url: string): string;
}

const scheduleStorageEstimateUpdate = (): void => {
  void updateStorageEstimate().catch(() => undefined);
};

setExternalResetHandler(() => resetCacheDatabases(updateStorageEstimate));

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

export const persistentFetch = async (
  url: string,
  cacheKeyBuilder?: UrlCacheKeyBuilder,
): Promise<string> => {
  const expectedEpoch = getCacheEpoch();
  const keyHash = await sha256String(cacheKeyBuilder?.(url) ?? url);
  return runSingleFlight(TEXT_DOMAIN, keyHash, expectedEpoch, async () => {
    const cached = await readCacheValue(TEXT_DOMAIN, keyHash, decodeText).catch(
      () => undefined,
    );
    if (cached !== undefined) return cached;

    const value = await fetchTextWithRetry(url);
    await writeCacheBytesIfAvailable(
      TEXT_DOMAIN,
      keyHash,
      encodeText(value),
      expectedEpoch,
      scheduleStorageEstimateUpdate,
    );
    return value;
  });
};

export const getOrSetApiFileCache = async (
  filePath: string,
  fallback: () => Promise<ApiFile>,
): Promise<ApiFile> => {
  const expectedEpoch = getCacheEpoch();
  const keyHash = await sha256String(filePath);
  return runSingleFlight(STRUCT_DOMAIN, keyHash, expectedEpoch, async () => {
    const cached = await readCacheValue(
      STRUCT_DOMAIN,
      keyHash,
      (bytes): ApiFile => {
        const value: unknown = JSON.parse(decodeText(bytes));
        if (
          typeof value !== 'object' ||
          value === null ||
          !('package' in value) ||
          !('imports' in value) ||
          !('structs' in value) ||
          typeof value.package !== 'string' ||
          !Array.isArray(value.imports) ||
          !Array.isArray(value.structs)
        ) {
          throw new Error('Cached API file value is invalid');
        }
        return value as ApiFile;
      },
    ).catch(() => undefined);
    if (cached !== undefined) return cached;

    const value = await fallback();
    await writeCacheBytesIfAvailable(
      STRUCT_DOMAIN,
      keyHash,
      encodeText(JSON.stringify(value)),
      expectedEpoch,
      scheduleStorageEstimateUpdate,
    );
    return value;
  });
};

export const check404File = async (filePath: string): Promise<boolean> => {
  const expectedEpoch = getCacheEpoch();
  const keyHash = await sha256String(filePath);
  const current = getLogicalFlight(TEXT_DOMAIN, keyHash, expectedEpoch);
  if (current) {
    try {
      const value: unknown = await current;
      return typeof value === 'string' && value.startsWith('404:');
    } catch {
      return false;
    }
  }
  const value = await readCacheValue(TEXT_DOMAIN, keyHash, decodeText).catch(
    () => undefined,
  );
  return value?.startsWith('404:') ?? false;
};

export const clearLocalCache = async (): Promise<void> => {
  invalidateLocalFlights();
  broadcastCacheReset();
  await resetCacheDatabases(updateStorageEstimate);
};
