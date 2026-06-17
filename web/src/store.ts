import {
  check404File,
  getOrSetStructCache,
  persistentFetch,
} from '@/utils/cache';
import type { ClassStruct } from '@ikun/syntax';
import pLimit from 'p-limit';
import { computed, shallowReactive, shallowRef } from 'vue';
import { emptyArray } from './utils/constant';
import { fixFilePath, getMirrorContentUrl } from './utils/url';
import defer * as syntax from '@ikun/syntax';

// preload syntax
setTimeout(async () => syntax, 3000);

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
      list = syntax.getAIDLStructList(text);
    } else if (url.endsWith('.java')) {
      list = syntax.getJavaStructList(text);
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
  const text = await persistentFetch(
    'https://raw.githubusercontent.com/android-cs/17/refs/tags/r1/aidl_java_files.txt',
  );
  const files = text.split('\n').sort();
  const normalFiles: string[] = [];
  const laterFiles: string[] = [];
  for (const file of files) {
    if (file.includes('/test/') || file.includes('/tests/')) {
      laterFiles.push(file);
    } else {
      normalFiles.push(file);
    }
  }
  aidlJavaFiles.value = normalFiles.concat(laterFiles);
});

// IActivityManager
// IActivityManager.java
// IActivityManager.
// android.app.IActivityManager

const targetUrlPrefix =
  'https://cs.android.com/android/platform/superproject/+/android-latest-release:frameworks/base/';

const aidlFileNameRegs = [/^I[A-Z].*/, /\.I[A-Z].*/];

const searchFilePathByName = (name: string): string | undefined => {
  name = fixFilePath(name.trim()).replaceAll('\\', '/').replace(/^\/+/, '');
  if (name.startsWith('frameworks/base/')) {
    name = name.substring('frameworks/base/'.length);
  }
  if (!name) return;
  if (name.endsWith('.java') || name.endsWith('.aidl')) {
    const a = `/${name}`;
    return aidlJavaFiles.value.find((v) => v === name || v.endsWith(a));
  }
  const perfAidl = aidlFileNameRegs.some((reg) => name.match(reg));
  name = name.replaceAll('.', '/');
  let a = '';
  if (perfAidl) {
    a = `/${name}.aidl`;
  } else {
    a = `/${name}.java`;
  }
  const ra = aidlJavaFiles.value.find((v) => v.endsWith(a));
  if (ra) return ra;
  if (!perfAidl) {
    a = `/${name}.aidl`;
  } else {
    a = `/${name}.java`;
  }
  return aidlJavaFiles.value.find((v) => v.endsWith(a));
};

interface FileTarget {
  filePath: string;
  targetPaths: string[];
}

const sourceFileReg = /\.(java|aidl)$/;
const propReg = /^[_0-9a-zA-Z]+/;

const getTargetUrl = (filePath: string): string => {
  return targetUrlPrefix + filePath;
};

const getFileStructName = (filePath: string): string => {
  return filePath.split('/').at(-1)!.replace(sourceFileReg, '');
};

const getMayFileRefNames = (name: string): string[] => {
  const r = new Set<string>([name]);
  const parts = name.split('.');
  const lastPart = parts.at(-1);
  if (lastPart?.endsWith('Hidden')) {
    parts[parts.length - 1] = lastPart.substring(
      0,
      lastPart.length - 'Hidden'.length,
    );
    r.add(parts.join('.'));
  }
  return Array.from(r);
};

const getPropName = (name: string): string => {
  return name.match(propReg)?.[0] || '';
};

const isLikelyMemberName = (name: string): boolean => {
  if (!name) return false;
  return /^[a-z_]/.test(name) || /^[A-Z0-9_]+$/.test(name);
};

const resolveFileTargets = (name: string): FileTarget[] => {
  name = name.replaceAll('$', '.').replace(/\.+$/g, '').trim();
  if (!name) return [];
  const parts = name.split('.').filter(Boolean);
  const res: FileTarget[] = [];
  const seen = new Set<string>();
  for (let i = parts.length; i > 0; i--) {
    const fileRef = parts.slice(0, i).join('.');
    const suffix = parts.slice(i);
    for (const mayFileRef of getMayFileRefNames(fileRef)) {
      const filePath = searchFilePathByName(mayFileRef);
      if (!filePath) continue;
      const targetPaths = [getFileStructName(filePath), ...suffix];
      const key = `${filePath}\n${targetPaths.join('.')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({
        filePath,
        targetPaths,
      });
    }
  }
  return res;
};

const createSearchFromData = (
  filePath: string,
  targetPaths: string[],
  targetKind: SearchFromData['targetKind'],
): SearchFromData => {
  return {
    targetUrl: getTargetUrl(filePath),
    targetPaths,
    targetKind,
  };
};

export const searchFilePathByRefName = (
  name: string,
): SearchFromData | undefined => {
  name = name.trim();
  if (!name) return;

  const fileName = fixFilePath(name);
  if (sourceFileReg.test(fileName)) {
    const filePath = searchFilePathByName(fileName);
    if (filePath) {
      return createSearchFromData(filePath, [], 'file');
    }
  }

  let className = name;
  let propName = '';
  if (name.includes('#')) {
    const parts = name.split('#', 2);
    className = parts[0];
    propName = getPropName(parts[1] || '');
  } else if (name.includes('.')) {
    const i = name.lastIndexOf('.');
    const mayPropName = getPropName(name.substring(i + 1));
    if (isLikelyMemberName(mayPropName)) {
      className = name.substring(0, i);
      propName = mayPropName;
    }
  }

  if (propName) {
    for (const target of resolveFileTargets(className)) {
      return createSearchFromData(
        target.filePath,
        [...target.targetPaths, propName],
        'member',
      );
    }
    return;
  }

  for (const target of resolveFileTargets(className)) {
    return createSearchFromData(target.filePath, target.targetPaths, 'class');
  }
};
