import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import {
  QUERY_CACHE_VERSION,
  STRUCT_CACHE_VERSION,
} from '@android-cs/api-query/query';
import type {
  AndroidApiQueryRuntime,
  AndroidApiStructCacheEntry,
  CacheStore,
} from '@android-cs/api-query';

const hashKey = (key: string): string => {
  return createHash('sha256').update(key).digest('base64url').slice(0, 24);
};

const getVersionDirName = (version: string): string => {
  return version.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const NETWORK_RETRY_COUNT = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchTextOnce = async (url: string): Promise<string> => {
  const response = await fetch(url);
  return response.text();
};

const fetchTextWithRetry = async (url: string): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRY_COUNT; attempt++) {
    try {
      return await fetchTextOnce(url);
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

class FileCache<T> implements CacheStore<T> {
  private readonly cacheDir: string;
  private readonly namespace: string;
  private readonly versionDirName?: string;
  private readonly codec: {
    encode(value: T): string;
    decode(value: string): T;
  };
  private preparePromise?: Promise<void>;

  constructor(
    cacheDir: string,
    namespace: string,
    codec: {
      encode(value: T): string;
      decode(value: string): T;
    },
    options: { version?: string } = {},
  ) {
    this.cacheDir = cacheDir;
    this.namespace = namespace;
    this.codec = codec;
    this.versionDirName = options.version
      ? getVersionDirName(options.version)
      : undefined;
  }

  private getNamespaceDir(): string {
    return join(this.cacheDir, this.namespace);
  }

  private getActiveDir(): string {
    return this.versionDirName
      ? join(this.getNamespaceDir(), this.versionDirName)
      : this.getNamespaceDir();
  }

  private getFilePath(key: string): string {
    return join(this.getActiveDir(), `${hashKey(key)}.cache`);
  }

  private async prepare(): Promise<void> {
    this.preparePromise ??= this.prepareCache();
    await this.preparePromise;
  }

  private async prepareCache(): Promise<void> {
    const namespaceDir = this.getNamespaceDir();
    await mkdir(namespaceDir, { recursive: true });

    if (!this.versionDirName) return;

    const entries = await readdir(namespaceDir, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.name !== this.versionDirName)
        .map((entry) =>
          rm(join(namespaceDir, entry.name), { recursive: true, force: true }),
        ),
    );
    await mkdir(this.getActiveDir(), { recursive: true });
  }

  async get(key: string): Promise<T | undefined> {
    await this.prepare();
    try {
      return this.codec.decode(await readFile(this.getFilePath(key), 'utf8'));
    } catch {
      return;
    }
  }

  async set(key: string, value: T): Promise<void> {
    await this.prepare();
    const filePath = this.getFilePath(key);
    await writeFile(filePath, this.codec.encode(value));
  }
}

const textCodec = {
  encode: (value: string) => value,
  decode: (value: string) => value,
};

const jsonCodec = <T>() => ({
  encode: (value: T) => JSON.stringify(value),
  decode: (value: string) => JSON.parse(value) as T,
});

export const getDefaultCacheDir = (): string => {
  return (
    process.env.ANDROID_API_DIFF_CACHE_DIR ||
    join(process.env.LOCALAPPDATA || homedir(), 'android-api-diff-cache')
  );
};

export const createNodeRuntime = (
  cacheDir = getDefaultCacheDir(),
): AndroidApiQueryRuntime => {
  return {
    fetchText: fetchTextWithRetry,
    sourceProvider: 'github-googlesource',
    textCache: new FileCache(cacheDir, 'text', textCodec),
    structCache: new FileCache(
      cacheDir,
      'struct',
      jsonCodec<AndroidApiStructCacheEntry>(),
      { version: STRUCT_CACHE_VERSION },
    ),
    queryCache: new FileCache(cacheDir, 'query', jsonCodec(), {
      version: QUERY_CACHE_VERSION,
    }),
  };
};
