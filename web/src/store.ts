import {
  check404File,
  getOrSetStructCache,
  persistentFetch,
} from '@/utils/cache';
import type { ClassStruct } from '@android-cs/api-parser';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName as searchFilePathByRefNameCore,
} from '@android-cs/api-query';
import pLimit from 'p-limit';
import { computed, shallowReactive, shallowRef } from 'vue';
import { emptyArray } from './utils/constants.ts';
import { getMirrorContentUrl } from './utils/url.ts';
import defer * as androidApiParser from '@android-cs/api-parser';

// preload parser
setTimeout(async () => androidApiParser, 3000);

export const fileStructsMap = shallowReactive<Record<string, ClassStruct[]>>(
  {},
);

export const notFoundFileMap = shallowReactive<Record<string, boolean>>({});

const limit = pLimit(5);
export const pullStructsByUrl = async (
  filePath: string,
  signal: AbortController,
): Promise<ClassStruct[]> => {
  const temp = fileStructsMap[filePath];
  if (temp) return temp;
  const url = getMirrorContentUrl(filePath);
  const list = await getOrSetStructCache(filePath, async () => {
    const text = await limit(() => {
      if (signal.signal.aborted) {
        throw new Error('aborted');
      }
      return persistentFetch(url);
    });
    let list: ClassStruct[] = [];
    if (text.startsWith('404:')) {
    } else if (url.endsWith('.aidl')) {
      list = androidApiParser.getAIDLStructList(text);
    } else if (url.endsWith('.java')) {
      list = androidApiParser.getJavaStructList(text);
    } else {
      // unsupported file type
    }
    return list;
  }).catch(() => {});
  if (!list) return emptyArray;
  if (list.length === 0) {
    const is404 = await check404File(url);
    if (is404) {
      notFoundFileMap[filePath] = is404;
    }
  }
  fileStructsMap[filePath] = list;
  return list;
};

const storageEstimate = shallowRef<StorageEstimate>();
export const updateStorageEstimate = async () => {
  if (navigator.storage?.estimate) {
    storageEstimate.value = await navigator.storage.estimate();
  }
};
setTimeout(updateStorageEstimate);
export const estimateDesc = computed(() => {
  if (!storageEstimate.value) return '';
  const usage = storageEstimate.value.usage;
  if (!usage) return '';
  return `${(usage / 1024 / 1024).toFixed(2)} MB`;
});

export const aidlJavaFiles = shallowRef<string[]>([]);
setTimeout(async () => {
  aidlJavaFiles.value = await loadAidlJavaFiles({
    fetchText: persistentFetch,
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
