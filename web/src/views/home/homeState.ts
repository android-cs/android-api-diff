import {
  aidlJavaFiles,
  fileStructsMap,
  notFoundFileMap,
  pullStructsByUrl,
  searchFilePathByRefName,
} from '@/store';
import { colors, findStructByPath, useEqualComputed, useTask } from '@/utils';
import androidVersionList from '@/utils/android.data';
import { emptyArray } from '@/utils/constants';
import { androidApiVersionList, DEFAULT_MIN_SDK } from '@/utils/constants';
import {
  DEFAULT_SOURCE_LINK_TARGET,
  getVersionUrlBuilder,
  sourceLinkTargetOptions,
  type SourceLinkTarget,
} from '@/utils/url';
import {
  createSharedComposable,
  useStorage,
  watchImmediate,
} from '@vueuse/core';
import { computed, onScopeDispose, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export const ANDROID_PREFIX_LEN = 'android-'.length;

export const NOT_FOUND_TYPE_COLOR = '#00000080';

const SKIP_NEXT_AUTO_DIFF_STATE_KEY = '__androidApiDiffSkipNextAutoDiff';
const DIFF_CONCURRENT_COUNT_STORAGE_KEY =
  'android-api-diff:diff-concurrent-count:v1';
const MIN_SDK_STORAGE_KEY = 'android-api-diff:min-sdk:v1';
const SOURCE_LINK_TARGET_STORAGE_KEY = 'android-api-diff:source-link-target:v1';
const SEARCH_HISTORY_STORAGE_KEY = 'android-api-diff:search-history:v1';
const DEFAULT_SEARCH_HISTORY = [
  'IActivityTaskManager.getTasks',
  'ITaskStackListener.onTaskMovedToFront',
  'IUserManager.getUsers',
];
const MAX_SEARCH_HISTORY = 20;
export const DEFAULT_DIFF_CONCURRENT_COUNT = 2;
export const MAX_DIFF_CONCURRENT_COUNT = 5;
export const diffConcurrentCountOptions = Array.from(
  { length: MAX_DIFF_CONCURRENT_COUNT },
  (_, index) => index + 1,
);

export const minSdkOptions = androidApiVersionList;

export { sourceLinkTargetOptions };

const normalizeDiffConcurrentCount = (value: unknown) => {
  const count = Number(value);
  if (!Number.isInteger(count)) return DEFAULT_DIFF_CONCURRENT_COUNT;
  return Math.min(Math.max(count, 1), MAX_DIFF_CONCURRENT_COUNT);
};

const normalizeMinSdk = (value: unknown) => {
  const sdk = Number(value);
  if (!Number.isInteger(sdk)) return DEFAULT_MIN_SDK;
  const minSdk = minSdkOptions[0];
  const maxSdk = minSdkOptions.at(-1)!;
  return Math.min(Math.max(sdk, minSdk), maxSdk);
};

const normalizeSourceLinkTarget = (value: unknown): SourceLinkTarget => {
  if (
    typeof value === 'string' &&
    (sourceLinkTargetOptions as readonly string[]).includes(value)
  ) {
    return value as SourceLinkTarget;
  }
  return DEFAULT_SOURCE_LINK_TARGET;
};

const normalizeSearchHistory = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const ref = item.trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    list.push(ref);
    if (list.length >= MAX_SEARCH_HISTORY) break;
  }
  return list;
};

export const skipNextAutoDiffOnReload = () => {
  sessionStorage.setItem(SKIP_NEXT_AUTO_DIFF_STATE_KEY, '1');
};

const consumeSkipNextAutoDiff = () => {
  if (!sessionStorage.getItem(SKIP_NEXT_AUTO_DIFF_STATE_KEY)) return false;
  sessionStorage.removeItem(SKIP_NEXT_AUTO_DIFF_STATE_KEY);
  return true;
};

const getPathMatchSearchRef = (v: unknown): string => {
  if (Array.isArray(v)) return v.join('/');
  if (typeof v === 'string') return v;
  return '';
};

const getHashSearchRef = (v: string): string => {
  return v.startsWith('#') ? v.substring(1) : v;
};

export const useSharedHomeState = createSharedComposable(() => {
  const route = useRoute();
  const router = useRouter();
  const diffConcurrentCount = useStorage<number>(
    DIFF_CONCURRENT_COUNT_STORAGE_KEY,
    DEFAULT_DIFF_CONCURRENT_COUNT,
    undefined,
    {
      flush: 'sync',
      serializer: {
        read: (raw) => normalizeDiffConcurrentCount(raw),
        write: (value) => String(normalizeDiffConcurrentCount(value)),
      },
    },
  );
  const minSdk = useStorage<number>(
    MIN_SDK_STORAGE_KEY,
    DEFAULT_MIN_SDK,
    undefined,
    {
      flush: 'sync',
      serializer: {
        read: (raw) => normalizeMinSdk(raw),
        write: (value) => String(normalizeMinSdk(value)),
      },
    },
  );
  const sourceLinkTarget = useStorage<SourceLinkTarget>(
    SOURCE_LINK_TARGET_STORAGE_KEY,
    DEFAULT_SOURCE_LINK_TARGET,
    undefined,
    {
      flush: 'sync',
      serializer: {
        read: (raw) => normalizeSourceLinkTarget(raw),
        write: (value) => normalizeSourceLinkTarget(value),
      },
    },
  );
  const searchHistory = useStorage<string[]>(
    SEARCH_HISTORY_STORAGE_KEY,
    () => [...DEFAULT_SEARCH_HISTORY],
    undefined,
    {
      flush: 'sync',
      serializer: {
        read: (raw) => {
          try {
            return normalizeSearchHistory(JSON.parse(raw));
          } catch {
            return [...DEFAULT_SEARCH_HISTORY];
          }
        },
        write: (value) => JSON.stringify(normalizeSearchHistory(value)),
      },
    },
  );

  const setSearchRef = async (v: string) => {
    if (v) {
      await router.replace('/i/' + v);
    } else {
      await router.replace('/');
    }
  };

  const searchRef = computed({
    get: () => {
      if (!route.path.startsWith('/i/')) return '';
      const pathRef = getPathMatchSearchRef(route.params.pathMatch);
      const hashRef = getHashSearchRef(route.hash);
      return route.hash ? `${pathRef}#${hashRef}` : pathRef;
    },
    set: (v: string) => {
      void setSearchRef(v);
    },
  });

  const rawTitle = document.title;
  onScopeDispose(() => (document.title = rawTitle));
  watchImmediate(
    computed(() => searchRef.value),
    (v) => {
      document.title = v || rawTitle;
    },
  );

  const emptySearchFromData: SearchFromData = {
    targetUrl: '',
    targetPaths: [],
    targetKind: 'file',
  };

  const searchFromData = useEqualComputed<SearchFromData>(() => {
    return searchFilePathByRefName(searchRef.value) ?? emptySearchFromData;
  });
  const isValidSearchRef = computed(() => !!searchFromData.value.targetUrl);

  const saveValidSearchHistory = (value = searchRef.value) => {
    const ref = value.trim();
    if (!ref || !searchFilePathByRefName(ref)?.targetUrl) return;
    searchHistory.value = [
      ref,
      ...searchHistory.value.filter((item) => item !== ref),
    ].slice(0, MAX_SEARCH_HISTORY);
  };

  const removeSearchHistory = (ref: string) => {
    searchHistory.value = searchHistory.value.filter((item) => item !== ref);
  };

  const urlBuilder = useEqualComputed(() =>
    getVersionUrlBuilder(searchFromData.value.targetUrl),
  );

  const filteredAndroidVersionList = computed(() =>
    androidVersionList.filter((v) => v.apiVersion >= minSdk.value),
  );

  const androidOrderTags = computed(() =>
    filteredAndroidVersionList.value.flatMap((v) => v.tags),
  );

  const isCanParsedUrl = computed(() => {
    const builder = urlBuilder.value;
    if (!builder) return false;
    const f = builder.filePath.substring('/'.length);
    return (
      (f.endsWith('.java') || f.endsWith('.aidl')) &&
      aidlJavaFiles.value.includes(f)
    );
  });

  const colorCache = new Map<string, string>();
  watch(searchFromData, () => colorCache.clear());
  const getCachedTypeColor = (key: string) => {
    if (!key) return '';
    const v = colorCache.get(key);
    if (v) return v;
    let i = colorCache.size;
    const color = colors[i % colors.length];
    colorCache.set(key, color);
    return color;
  };

  const diffResultList = computed<DiffResultItem[]>(() => {
    const builder = urlBuilder.value;
    if (!builder?.filePath) return emptyArray;
    const targetKind = searchFromData.value.targetKind;
    const targetPaths = searchFromData.value.targetPaths;
    if (!isCanParsedUrl.value) return emptyArray;
    if (targetKind !== 'file' && targetPaths.length === 0) return emptyArray;
    return androidOrderTags.value
      .map((tag) => {
        const filePath = tag + builder.filePath;
        const structs = fileStructsMap[filePath];
        if (!structs) return;
        let typeDesc = '';
        const notFound = notFoundFileMap[filePath];
        let typeColor = notFound ? NOT_FOUND_TYPE_COLOR : '#000';
        let target: DiffResultItem['target'];
        let members: DiffResultItem['members'] | undefined;

        if (!notFound) {
          if (targetKind === 'file') {
            typeColor = colors[0];
          } else if (targetKind === 'class') {
            target = findStructByPath(structs, targetPaths);
            if (target) {
              typeColor = colors[0];
            }
          } else {
            const propName = targetPaths.at(-1);
            target = findStructByPath(structs, targetPaths.slice(0, -1));
            if (target && propName) {
              members = target.members.filter((v) => v.name === propName);
              if (members.length > 0) {
                typeDesc = members
                  .sort(
                    (a, b) => (a.parameterCount ?? 0) - (b.parameterCount ?? 0),
                  )
                  .map((v) => v.type)
                  .join('\n');
                typeColor = getCachedTypeColor(typeDesc);
              }
            }
          }
        }
        const r: DiffResultItem = {
          tag,
          structs,
          target,
          members,
          typeDesc,
          typeColor,
          notFound,
        };
        return r;
      })
      .filter((v): v is DiffResultItem => !!v);
  });
  const getDiffResult = (tag: string): DiffResultItem | undefined => {
    return diffResultList.value.find((v) => v.tag === tag);
  };

  const diffTypeReult = useEqualComputed<DiffTypeItem[]>(() => {
    const list: DiffTypeItem[] = [];
    androidOrderTags.value.forEach((tag, index) => {
      const res = getDiffResult(tag);
      let typeItem: DiffTypeItem | undefined;
      if (res) {
        typeItem = list.find(
          (v) => v.typeDesc === res.typeDesc && v.typeColor === res.typeColor,
        );
        if (!typeItem) {
          typeItem = {
            typeDesc: res.typeDesc,
            typeColor: res.typeColor,
            tagRanges: [],
          };
          list.push(typeItem);
        }
      } else {
        typeItem = list.at(-1);
      }
      if (!typeItem) return;
      if (typeItem.tagRanges.length === 0) {
        typeItem.tagRanges.push([tag]);
        return;
      }
      const lastTag = androidOrderTags.value[index - 1];
      const lastRange = typeItem.tagRanges.at(-1)!;
      if (lastRange.at(-1) === lastTag) {
        lastRange.push(tag);
      } else {
        typeItem.tagRanges.push([tag]);
      }
    });
    return list;
  });

  let signal = new AbortController();
  const stopDiff = () => {
    signal.abort();
    signal = new AbortController();
  };
  onUnmounted(stopDiff);

  const handleDiff = useTask(async () => {
    const s = signal;
    while (aidlJavaFiles.value.length === 0) {
      await new Promise((r) => setTimeout(r));
      if (s.signal.aborted) return;
    }
    if (!urlBuilder.value) return;
    const builder = urlBuilder.value;
    const versionList = filteredAndroidVersionList.value;
    // 数组作为矩阵列，按行遍历，优先访问每个大版本的头部的小版本
    const maxRows = versionList.reduce((m, v) => Math.max(m, v.tags.length), 0);
    const tempList: Promise<unknown>[] = [];
    const awaitTempList = async () => {
      return Promise.all(tempList).finally(() => tempList.splice(0));
    };
    for (let row = 0; row < maxRows; row++) {
      for (const version of versionList) {
        if (row >= version.tags.length) continue;
        if (s.signal.aborted) return;
        tempList.push(
          pullStructsByUrl(version.tags[row] + builder.filePath, s),
        );
        if (tempList.length >= diffConcurrentCount.value) {
          await awaitTempList();
        }
      }
    }
    if (tempList.length > 0) {
      await awaitTempList();
    }
  });
  if (!consumeSkipNextAutoDiff()) {
    setTimeout(handleDiff.invoke);
  }

  const runDiffWithSearchHistory = async () => {
    saveValidSearchHistory();
    await handleDiff.invoke();
    saveValidSearchHistory();
  };

  const selectSearchHistory = async (ref: string) => {
    await setSearchRef(ref);
    saveValidSearchHistory(ref);
    await handleDiff.invoke();
    saveValidSearchHistory(ref);
  };

  const androidVersionColors = useEqualComputed<Record<string, string[]>>(
    () => {
      const map: Record<string, string[]> = {};
      filteredAndroidVersionList.value.forEach((v) => {
        map[v.version] = Array.from(
          new Set(
            diffResultList.value
              .filter((d) => v.tags.includes(d.tag))
              .map((d) => d.typeColor),
          ),
        );
      });
      return map;
    },
  );

  return {
    searchFromData,
    isCanParsedUrl,
    diffResultList,
    diffTypeReult,
    handleDiff,
    isValidSearchRef,
    searchRef,
    searchHistory,
    runDiffWithSearchHistory,
    selectSearchHistory,
    removeSearchHistory,
    setSearchRef,
    stopDiff,
    getDiffResult,
    urlBuilder,
    androidVersionList: filteredAndroidVersionList,
    androidVersionColors,
    diffConcurrentCount,
    diffConcurrentCountOptions,
    minSdk,
    minSdkOptions,
    sourceLinkTarget,
    sourceLinkTargetOptions,
  };
});
