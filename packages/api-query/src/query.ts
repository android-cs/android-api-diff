import type { ClassMember, ClassStruct } from '@android-cs/api-parser';
import { getAIDLStructList, getJavaStructList } from '@android-cs/api-parser';
import pLimit from 'p-limit';
import { DEFAULT_MIN_SDK } from './constants.ts';
import { loadAidlJavaFiles, loadAndroidVersionList } from './data.ts';
import {
  isConstructorReference,
  searchFilePathByRefName,
  toAndroidApiResolution,
} from './resolve.ts';
import { findStructPathByPath } from './struct.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiMissingReason,
  AndroidApiQueryResult,
  AndroidApiQueryRuntime,
  AndroidApiResolvedType,
  AndroidApiStructCacheEntry,
  AndroidApiVersionRangeResult,
  AndroidVersionItem,
  QueryAndroidApiOptions,
} from './types.ts';
import { getMirrorContentUrl } from './url.ts';

export const STRUCT_CACHE_VERSION = 'struct:v9';
export const QUERY_CACHE_VERSION = 'query:v20';
const DEFAULT_CONCURRENCY = 3;

interface InternalAndroidApiVersionResult {
  version: string;
  alias: string;
  apiVersion: number;
  tag: string;
  missingReason?: AndroidApiMissingReason;
  signature?: string;
  members?: AndroidApiMemberResult[];
  typePath?: AndroidApiResolvedType[];
}

const normalizeConcurrency = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return DEFAULT_CONCURRENCY;
  }
  return Math.floor(value);
};

const fetchTaggedFileText = async (
  runtime: AndroidApiQueryRuntime,
  taggedFilePath: string,
  signal?: AbortSignal,
): Promise<{ text: string; sourceFileNotFound: boolean }> => {
  const url = getMirrorContentUrl(taggedFilePath);
  const rawText = await runtime.fetchText(url, signal);
  return {
    text: rawText,
    sourceFileNotFound: rawText.startsWith('404:'),
  };
};

const getTaggedFileText = async (
  runtime: AndroidApiQueryRuntime,
  taggedFilePath: string,
  signal?: AbortSignal,
): Promise<{ text: string; sourceFileNotFound: boolean }> => {
  const cached = await runtime.textCache?.get(taggedFilePath);
  if (cached !== undefined) {
    return { text: cached, sourceFileNotFound: false };
  }

  const result = await fetchTaggedFileText(runtime, taggedFilePath, signal);
  if (!result.sourceFileNotFound) {
    await runtime.textCache?.set(taggedFilePath, result.text);
  }
  return result;
};

const getStructsByTaggedFile = async (
  runtime: AndroidApiQueryRuntime,
  taggedFilePath: string,
  signal?: AbortSignal,
): Promise<AndroidApiStructCacheEntry> => {
  const structKey = `${STRUCT_CACHE_VERSION}:${taggedFilePath}`;
  const cached = await runtime.structCache?.get(structKey);
  if (cached) return cached;

  const { text, sourceFileNotFound } = await getTaggedFileText(
    runtime,
    taggedFilePath,
    signal,
  );
  let list: ClassStruct[] = [];
  if (!sourceFileNotFound && taggedFilePath.endsWith('.aidl')) {
    list = getAIDLStructList(text);
  } else if (!sourceFileNotFound && taggedFilePath.endsWith('.java')) {
    list = getJavaStructList(text);
  }
  const result: AndroidApiStructCacheEntry = {
    structs: list,
    sourceFileNotFound,
  };
  await runtime.structCache?.set(structKey, result);
  return result;
};

const getSelectedTags = (
  androidVersionList: AndroidVersionItem[],
  options: QueryAndroidApiOptions,
): AndroidVersionItem[] => {
  const minSdk = options.minSdk ?? DEFAULT_MIN_SDK;
  return androidVersionList
    .filter((v) => v.apiVersion >= minSdk)
    .filter((v) => v.tags.length > 0);
};

const cloneParameters = (
  member: Extract<ClassMember, { parameters: unknown }>,
) => {
  return member.parameters.map((parameter) => ({ ...parameter }));
};

const toResultMember = (member: ClassMember): AndroidApiMemberResult => {
  if (member.kind === 'method') {
    return {
      kind: member.kind,
      name: member.name,
      type: member.type,
      ...(member.isAbstract ? { isAbstract: true } : {}),
      returnType: member.returnType,
      ...(member.returnNullability
        ? { returnNullability: member.returnNullability }
        : {}),
      parameters: cloneParameters(member),
    };
  }
  if (member.kind === 'constructor') {
    return {
      kind: member.kind,
      name: member.name,
      type: member.type,
      parameters: cloneParameters(member),
    };
  }
  return {
    kind: member.kind,
    name: member.name,
    type: member.type,
    ...(member.fieldNullability
      ? { fieldNullability: member.fieldNullability }
      : {}),
  };
};

const toResolvedType = (struct: ClassStruct): AndroidApiResolvedType => {
  return {
    name: struct.name,
    kind: struct.isInterface ? 'interface' : 'class',
    ...(struct.isAbstract ? { isAbstract: true } : {}),
  };
};

const getTagRevision = (tag: string): number => {
  return Number(tag.match(/_r(\d+)$/)?.[1] ?? 0);
};

const compareVersionResults = (
  a: InternalAndroidApiVersionResult,
  b: InternalAndroidApiVersionResult,
) => {
  return (
    a.apiVersion - b.apiVersion ||
    getTagRevision(a.tag) - getTagRevision(b.tag) ||
    a.tag.localeCompare(b.tag)
  );
};

const toSemanticMember = (member: AndroidApiMemberResult) => {
  return {
    kind: member.kind,
    name: member.name,
    type: member.type,
    ...('returnType' in member ? { returnType: member.returnType } : {}),
    ...('isAbstract' in member && member.isAbstract
      ? { isAbstract: true }
      : {}),
    ...('returnNullability' in member
      ? { returnNullability: member.returnNullability }
      : {}),
    ...('parameters' in member
      ? {
          parameters: member.parameters.map((parameter) => ({
            name: parameter.name,
            type: parameter.type,
            nullability: parameter.nullability,
          })),
        }
      : {}),
    ...('fieldNullability' in member
      ? { fieldNullability: member.fieldNullability }
      : {}),
  };
};

const toSemanticKey = (version: InternalAndroidApiVersionResult): string => {
  return JSON.stringify({
    missingReason: version.missingReason,
    members: version.members?.map(toSemanticMember),
  });
};

const toRange = (
  version: InternalAndroidApiVersionResult,
): AndroidApiVersionRangeResult => {
  return {
    fromVersion: version.version,
    fromAlias: version.alias,
    fromApiVersion: version.apiVersion,
    fromTag: version.tag,
    toVersion: version.version,
    toAlias: version.alias,
    toApiVersion: version.apiVersion,
    toTag: version.tag,
    ...(version.missingReason ? { missingReason: version.missingReason } : {}),
    members: version.members,
  };
};

const extendRange = (
  range: AndroidApiVersionRangeResult,
  version: InternalAndroidApiVersionResult,
) => {
  range.toVersion = version.version;
  range.toAlias = version.alias;
  range.toApiVersion = version.apiVersion;
  range.toTag = version.tag;
  range.members = version.members;
};

const getVersionIdentity = (version: {
  version: string;
  apiVersion: number;
}): string => {
  return `${version.apiVersion}:${version.version}`;
};

const addCheckedTagPositions = (
  ranges: AndroidApiVersionRangeResult[],
  versions: InternalAndroidApiVersionResult[],
): AndroidApiVersionRangeResult[] => {
  const firstTags = new Map<string, string>();
  const lastTags = new Map<string, string>();
  for (const version of versions) {
    const key = getVersionIdentity(version);
    if (!firstTags.has(key)) firstTags.set(key, version.tag);
    lastTags.set(key, version.tag);
  }
  for (const range of ranges) {
    if (
      firstTags.get(
        getVersionIdentity({
          version: range.fromVersion,
          apiVersion: range.fromApiVersion,
        }),
      ) === range.fromTag
    ) {
      range.fromTagPosition = 'first-checked';
    }
    if (
      lastTags.get(
        getVersionIdentity({
          version: range.toVersion,
          apiVersion: range.toApiVersion,
        }),
      ) === range.toTag
    ) {
      range.toTagPosition = 'last-checked';
    }
  }
  return ranges;
};

const compactVersionResults = (
  versions: InternalAndroidApiVersionResult[],
): AndroidApiVersionRangeResult[] => {
  const ranges: AndroidApiVersionRangeResult[] = [];
  let previousKey = '';
  for (const version of versions) {
    const key = toSemanticKey(version);
    const lastRange = ranges.at(-1);
    if (lastRange && key === previousKey) {
      extendRange(lastRange, version);
    } else {
      ranges.push(toRange(version));
      previousKey = key;
    }
  }
  return addCheckedTagPositions(ranges, versions);
};

const getQueryCacheKey = (options: QueryAndroidApiOptions): string => {
  return [
    QUERY_CACHE_VERSION,
    options.apiName.trim(),
    options.minSdk ?? '',
  ].join(':');
};

export const queryAndroidApi = async (
  runtime: AndroidApiQueryRuntime,
  options: QueryAndroidApiOptions,
): Promise<AndroidApiQueryResult> => {
  options.signal?.throwIfAborted();
  const normalizedApiName = options.apiName.trim();
  const cacheKey = getQueryCacheKey({
    ...options,
    apiName: normalizedApiName,
  });
  const cached = await runtime.queryCache?.get(cacheKey);
  options.signal?.throwIfAborted();
  if (cached) return cached;

  const aidlJavaFiles = await loadAidlJavaFiles(runtime, options.signal);
  options.signal?.throwIfAborted();
  const search = searchFilePathByRefName(normalizedApiName, aidlJavaFiles);
  if (!search) {
    const result: AndroidApiQueryResult = {
      apiName: options.apiName,
      normalizedApiName,
      summary: {
        checkedTags: 0,
        foundTags: 0,
        rangeCount: 0,
        signatures: [],
      },
      ranges: [],
    };
    await runtime.queryCache?.set(cacheKey, result);
    return result;
  }
  const constructorReference = isConstructorReference(
    normalizedApiName,
    aidlJavaFiles,
    search,
  );

  const resolution = toAndroidApiResolution(search)!;
  const androidVersionList = getSelectedTags(
    await loadAndroidVersionList(runtime, options.signal),
    options,
  );
  options.signal?.throwIfAborted();
  const taggedVersions = androidVersionList.flatMap((version) =>
    version.tags.map((tag) => ({ tag, version })),
  );
  let completedTags = 0;
  await options.onProgress?.({
    completedTags,
    totalTags: taggedVersions.length,
  });
  const limit = pLimit(normalizeConcurrency(options.concurrency));
  const versions = (
    await Promise.all(
      taggedVersions.map(({ tag, version }) =>
        limit(async (): Promise<InternalAndroidApiVersionResult> => {
          options.signal?.throwIfAborted();
          const taggedFilePath = `${tag}/${search.filePath}`;
          const { structs, sourceFileNotFound } = await getStructsByTaggedFile(
            runtime,
            taggedFilePath,
            options.signal,
          );
          options.signal?.throwIfAborted();
          let targetFound = false;
          let members: AndroidApiMemberResult[] | undefined;
          let typePath: AndroidApiResolvedType[] | undefined;
          let signature = '';

          if (!sourceFileNotFound) {
            if (search.targetKind === 'file') {
              targetFound = true;
            } else if (search.targetKind === 'class') {
              const foundTypePath = findStructPathByPath(
                structs,
                search.targetPaths,
              );
              if (foundTypePath) {
                targetFound = true;
                typePath = foundTypePath.map(toResolvedType);
              }
            } else {
              const propName = search.targetPaths.at(-1);
              const foundTypePath = findStructPathByPath(
                structs,
                search.targetPaths.slice(0, -1),
              );
              const foundTarget = foundTypePath?.at(-1);
              if (foundTypePath && foundTarget && propName) {
                typePath = foundTypePath.map(toResolvedType);
                const matchedMembers = foundTarget.members.filter(
                  (v) =>
                    v.name === propName &&
                    (!constructorReference || v.kind === 'constructor'),
                );
                if (matchedMembers.length > 0) {
                  targetFound = true;
                  members = [...matchedMembers]
                    .sort(
                      (a, b) =>
                        (a.parameterCount ?? 0) - (b.parameterCount ?? 0),
                    )
                    .map(toResultMember);
                  signature = members.map((v) => v.type).join('\n');
                }
              }
            }
          }

          const isApiFound =
            search.targetKind === 'file'
              ? !sourceFileNotFound
              : targetFound || !!members?.length;
          const missingReason = isApiFound
            ? undefined
            : sourceFileNotFound
              ? 'source-file-not-found'
              : 'api-not-found';

          const result: InternalAndroidApiVersionResult = {
            version: version.version,
            alias: version.alias,
            apiVersion: version.apiVersion,
            tag,
            ...(missingReason ? { missingReason } : {}),
            ...(signature ? { signature } : {}),
            members,
            ...(typePath ? { typePath } : {}),
          };
          completedTags++;
          await options.onProgress?.({
            completedTags,
            totalTags: taggedVersions.length,
            currentTag: tag,
          });
          return result;
        }),
      ),
    )
  ).sort(compareVersionResults);

  const foundVersions = versions.filter((v) => !v.missingReason);
  const ranges = compactVersionResults(versions);
  const signatures = Array.from(
    new Set(foundVersions.flatMap((v) => (v.signature ? [v.signature] : []))),
  );
  const typePath = versions.findLast((version) => version.typePath)?.typePath;
  const result: AndroidApiQueryResult = {
    apiName: options.apiName,
    normalizedApiName,
    source: resolution.source,
    resolvedTarget: {
      ...resolution.resolvedTarget,
      ...(typePath ? { typePath } : {}),
    },
    summary: {
      checkedTags: versions.length,
      foundTags: foundVersions.length,
      rangeCount: ranges.length,
      firstFoundTag: foundVersions[0]?.tag,
      lastFoundTag: foundVersions.at(-1)?.tag,
      signatures,
    },
    ranges,
  };
  await runtime.queryCache?.set(cacheKey, result);
  return result;
};
