import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AndroidVersionItem } from '@android-cs/api-query';

// Bump when version metadata, tag selection, or the cache schema changes.
export const ANDROID_VERSION_CACHE_VERSION = 1;
export const ANDROID_VERSION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
export const ANDROID_VERSION_CACHE_PATH = fileURLToPath(
  new URL('../../../.cache/android-versions.json', import.meta.url),
);

const isVersionList = (value: unknown): value is AndroidVersionItem[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      typeof item.version === 'string' &&
      typeof item.alias === 'string' &&
      Number.isInteger(item.apiVersion) &&
      item.apiVersion > 0 &&
      Array.isArray(item.tags) &&
      item.tags.every((tag: unknown) => typeof tag === 'string') &&
      Array.isArray(item.futureTags) &&
      item.futureTags.every((tag: unknown) => typeof tag === 'string'),
  );

export const loadCachedAndroidVersions = async (
  load: () => Promise<AndroidVersionItem[]>,
  options: { path?: string; now?: () => number } = {},
): Promise<AndroidVersionItem[]> => {
  const path = options.path ?? ANDROID_VERSION_CACHE_PATH;
  const now = options.now ?? Date.now;
  try {
    const cached = JSON.parse(await readFile(path, 'utf8'));
    const age = now() - cached.createdAt;
    if (
      cached.version === ANDROID_VERSION_CACHE_VERSION &&
      typeof cached.createdAt === 'number' &&
      age >= 0 &&
      age < ANDROID_VERSION_CACHE_TTL &&
      isVersionList(cached.data)
    ) {
      return cached.data;
    }
  } catch {
    // Missing, unreadable, or corrupt caches are refreshed from the source.
  }

  const data = await load();
  if (!isVersionList(data)) throw new Error('Invalid Android version list');
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(
      temporaryPath,
      JSON.stringify({
        version: ANDROID_VERSION_CACHE_VERSION,
        createdAt: now(),
        data,
      }),
      'utf8',
    );
    await rename(temporaryPath, path);
  } catch (error) {
    console.warn('[android.data] Unable to write version cache:', error);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
  return data;
};
