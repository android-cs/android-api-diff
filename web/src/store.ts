import {
  check404File,
  getOrSetApiFileCache,
  persistentFetch,
} from '@/utils/cache';
import type { ApiFile } from '@android-cs/api-parser';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName as searchFilePathByRefNameCore,
} from '@android-cs/api-query';
import pLimit from 'p-limit';
import { shallowReactive, shallowRef } from 'vue';
import { emptyArray } from './utils/constants.ts';
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
export const pullApiFileByUrl = async (
  filePath: string,
  signal: AbortController,
): Promise<ApiFile> => {
  const temp = fileApiMap[filePath];
  if (temp) return temp;
  const url = getMirrorContentUrl(filePath);
  const file = await getOrSetApiFileCache(filePath, async () => {
    const text = await limit(() => {
      if (signal.signal.aborted) {
        throw new Error('aborted');
      }
      return persistentFetch(url);
    });
    let file: ApiFile = {
      package: '',
      imports: [],
      structs: [],
    };
    if (text.startsWith('404:')) {
    } else if (url.endsWith('.aidl')) {
      file = androidApiParser.parseAIDLFile(text);
    } else if (url.endsWith('.java')) {
      file = androidApiParser.parseJavaFile(text);
    } else {
      // unsupported file type
    }
    return file;
  }).catch(() => {});
  if (!file) {
    return {
      package: '',
      imports: [],
      structs: emptyArray,
    };
  }
  if (file.structs.length === 0) {
    const is404 = await check404File(url);
    if (is404) {
      notFoundFileMap[filePath] = is404;
    }
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
