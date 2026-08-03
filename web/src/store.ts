import { getOrSetApiFileCache, persistentFetch } from '@/utils/cache';
import type { ApiFile } from '@android-cs/api-parser';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName as searchFilePathByRefNameCore,
} from '@android-cs/api-query';
import pLimit from 'p-limit';
import { shallowReactive, shallowRef } from 'vue';
import { emptyArray } from './utils/constants.ts';
import { sha256String } from './utils/cache/compression.ts';
import { updateStorageEstimate } from './utils/storageEstimate.ts';
import { getMirrorContentUrl } from './utils/url.ts';
import defer * as androidApiParser from '@android-cs/api-parser';

export {
  estimateDesc,
  updateStorageEstimate,
} from './utils/storageEstimate.ts';

// preload parser
setTimeout(async () => androidApiParser, 3000);

export const fileApiMap = shallowReactive<Record<string, ApiFile>>({});

export const notFoundFileMap = shallowReactive<Record<string, boolean>>({});

const limit = pLimit(5);
const MAX_PARSED_SOURCE_ENTRIES = 256;
const parsedApiFilesBySource = new Map<string, ApiFile>();
const parsedApiFileFlights = new Map<string, Promise<ApiFile>>();

const rememberParsedApiFile = (sourceKey: string, file: ApiFile): ApiFile => {
  const current = parsedApiFilesBySource.get(sourceKey);
  if (current) {
    parsedApiFilesBySource.delete(sourceKey);
    parsedApiFilesBySource.set(sourceKey, current);
    return current;
  }
  parsedApiFilesBySource.set(sourceKey, file);
  if (parsedApiFilesBySource.size > MAX_PARSED_SOURCE_ENTRIES) {
    const oldestKey = parsedApiFilesBySource.keys().next().value;
    if (oldestKey !== undefined) parsedApiFilesBySource.delete(oldestKey);
  }
  return file;
};

const replaceParsedApiFile = (sourceKey: string, file: ApiFile): void => {
  parsedApiFilesBySource.delete(sourceKey);
  parsedApiFilesBySource.set(sourceKey, file);
  if (parsedApiFilesBySource.size > MAX_PARSED_SOURCE_ENTRIES) {
    const oldestKey = parsedApiFilesBySource.keys().next().value;
    if (oldestKey !== undefined) parsedApiFilesBySource.delete(oldestKey);
  }
};

const getOrParseApiFile = (
  sourceKey: string,
  parse: () => ApiFile | Promise<ApiFile>,
): Promise<ApiFile> => {
  const cached = parsedApiFilesBySource.get(sourceKey);
  if (cached) return Promise.resolve(rememberParsedApiFile(sourceKey, cached));
  const current = parsedApiFileFlights.get(sourceKey);
  if (current) return current;

  const promise = Promise.resolve()
    .then(parse)
    .then((file) => rememberParsedApiFile(sourceKey, file));
  parsedApiFileFlights.set(sourceKey, promise);
  const clear = () => {
    if (parsedApiFileFlights.get(sourceKey) === promise) {
      parsedApiFileFlights.delete(sourceKey);
    }
  };
  void promise.then(clear, clear);
  return promise;
};

export const pullApiFileByUrl = async (
  filePath: string,
  signal: AbortController,
): Promise<ApiFile> => {
  const temp = fileApiMap[filePath];
  if (temp) return temp;
  const url = getMirrorContentUrl(filePath);
  let parsedSourceKey: string | undefined;
  const entry = await getOrSetApiFileCache(filePath, async () => {
    const text = await limit(() => {
      if (signal.signal.aborted) {
        throw new Error('aborted');
      }
      return persistentFetch(url);
    });
    const parserKind = url.endsWith('.aidl')
      ? 'aidl'
      : url.endsWith('.java')
        ? 'java'
        : 'unsupported';
    const sourceFileNotFound = text.startsWith('404:');
    const sourceHash = sourceFileNotFound
      ? 'not-found'
      : await sha256String(text);
    const sourceKey = `${parserKind}:${sourceHash}`;
    parsedSourceKey = sourceKey;
    const memoryCached = parsedApiFilesBySource.get(sourceKey);
    if (memoryCached) {
      return {
        file: rememberParsedApiFile(sourceKey, memoryCached),
        sourceFileNotFound,
      };
    }
    const parsedEntry = await getOrSetApiFileCache(
      `struct-content:${sourceKey}`,
      async () => ({
        file: await getOrParseApiFile(sourceKey, async () => {
          if (sourceFileNotFound || parserKind === 'unsupported') {
            return {
              package: '',
              imports: [],
              structs: [],
            };
          }
          return parserKind === 'aidl'
            ? androidApiParser.parseAIDLFile(text)
            : androidApiParser.parseJavaFile(text);
        }),
        sourceFileNotFound,
      }),
    );
    replaceParsedApiFile(sourceKey, parsedEntry.file);
    return parsedEntry;
  }).catch(() => {});
  if (!entry) {
    return {
      package: '',
      imports: [],
      structs: emptyArray,
    };
  }
  const { file, sourceFileNotFound } = entry;
  if (sourceFileNotFound) {
    notFoundFileMap[filePath] = true;
  } else {
    delete notFoundFileMap[filePath];
  }
  if (parsedSourceKey) {
    replaceParsedApiFile(parsedSourceKey, file);
  }
  fileApiMap[filePath] = file;
  return file;
};

setTimeout(updateStorageEstimate);

export const aidlJavaFiles = shallowRef<string[]>([]);
setTimeout(async () => {
  aidlJavaFiles.value = await loadAidlJavaFiles({
    fetchText: (url) => persistentFetch(url),
  });
});

// IActivityManager
// IActivityManager.java
// IActivityManager.
// android.app.IActivityManager

export const searchFilePathByRefName = (
  name: string,
): SearchFromData | undefined => {
  return searchFilePathByRefNameCore(name, aidlJavaFiles.value);
};
