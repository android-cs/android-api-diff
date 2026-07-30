import type { ApiFile, ClassMember } from '@android-cs/api-parser';
import { parseAIDLFile, parseJavaFile } from '@android-cs/api-parser';
import pLimit from 'p-limit';
import { DEFAULT_MIN_SDK } from './constants.ts';
import { loadAidlJavaFiles, loadAndroidVersionList } from './data.ts';
import {
  isConstructorReference,
  searchFilePathByRefName,
  toAndroidApiResolution,
} from './resolve.ts';
import { findStructPathByPath, toAndroidApiResolvedType } from './struct.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiMissingReason,
  AndroidApiOverloadResult,
  AndroidApiOverloadVersionRangeResult,
  AndroidApiQueryResult,
  AndroidApiQueryRuntime,
  AndroidApiResolvedType,
  AndroidApiStructCacheEntry,
  AndroidApiVersionRange,
  AndroidApiVersionRangeResult,
  AndroidVersionItem,
  QueryAndroidApiOptions,
} from './types.ts';
import { getMirrorContentUrl } from './url.ts';

export const STRUCT_CACHE_VERSION = 'struct:v11';
export const QUERY_CACHE_VERSION = 'query:v23';
const DEFAULT_CONCURRENCY = 3;
const MAX_STRUCT_CONTENT_ENTRIES = 256;

interface StructContentMemo {
  values: Map<string, AndroidApiStructCacheEntry>;
  flights: Map<string, Promise<AndroidApiStructCacheEntry>>;
}

const structContentMemos = new WeakMap<
  AndroidApiQueryRuntime,
  StructContentMemo
>();
const structSourceEncoder = new TextEncoder();

const getStructContentMemo = (
  runtime: AndroidApiQueryRuntime,
): StructContentMemo => {
  let memo = structContentMemos.get(runtime);
  if (!memo) {
    memo = {
      values: new Map(),
      flights: new Map(),
    };
    structContentMemos.set(runtime, memo);
  }
  return memo;
};

const rememberStructContent = (
  memo: StructContentMemo,
  contentKey: string,
  value: AndroidApiStructCacheEntry,
): AndroidApiStructCacheEntry => {
  const current = memo.values.get(contentKey);
  if (current) {
    memo.values.delete(contentKey);
    memo.values.set(contentKey, current);
    return current;
  }
  memo.values.set(contentKey, value);
  if (memo.values.size > MAX_STRUCT_CONTENT_ENTRIES) {
    const oldestKey = memo.values.keys().next().value;
    if (oldestKey !== undefined) memo.values.delete(oldestKey);
  }
  return value;
};

const hashStructSource = async (text: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    structSourceEncoder.encode(text),
  );
  return new Uint8Array(digest).toBase64({
    alphabet: 'base64url',
    omitPadding: true,
  });
};

const getStructContentKey = async (
  taggedFilePath: string,
  text: string,
  sourceFileNotFound: boolean,
): Promise<string> => {
  const parserKind = taggedFilePath.endsWith('.aidl')
    ? 'aidl'
    : taggedFilePath.endsWith('.java')
      ? 'java'
      : 'unsupported';
  const sourceHash = sourceFileNotFound
    ? 'not-found'
    : await hashStructSource(text);
  return `${parserKind}:${sourceHash}`;
};

const getStructsByContent = async (
  runtime: AndroidApiQueryRuntime,
  contentKey: string,
  text: string,
  sourceFileNotFound: boolean,
): Promise<AndroidApiStructCacheEntry> => {
  const memo = getStructContentMemo(runtime);
  const memoized = memo.values.get(contentKey);
  if (memoized) return rememberStructContent(memo, contentKey, memoized);
  const current = memo.flights.get(contentKey);
  if (current) return current;

  const promise = (async () => {
    const persistentKey = `${STRUCT_CACHE_VERSION}:content:${contentKey}`;
    const persistent = await runtime.structCache?.get(persistentKey);
    if (persistent) return persistent;

    let file: ApiFile = {
      package: '',
      imports: [],
      structs: [],
    };
    if (!sourceFileNotFound && contentKey.startsWith('aidl:')) {
      file = parseAIDLFile(text);
    } else if (!sourceFileNotFound && contentKey.startsWith('java:')) {
      file = parseJavaFile(text);
    }
    const parsed: AndroidApiStructCacheEntry = {
      file,
      sourceFileNotFound,
    };
    const value = runtime.structCache?.intern?.(parsed) ?? parsed;
    await runtime.structCache?.set(persistentKey, value);
    return value;
  })();
  memo.flights.set(contentKey, promise);
  try {
    const value = await promise;
    return rememberStructContent(memo, contentKey, value);
  } finally {
    if (memo.flights.get(contentKey) === promise) {
      memo.flights.delete(contentKey);
    }
  }
};

interface InternalAndroidApiVersionResult {
  version: string;
  alias: string;
  apiVersion: number;
  tag: string;
  missingReason?: AndroidApiMissingReason;
  members?: AndroidApiMemberResult[];
  package: string;
  imports: string[];
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
  const contentKey = await getStructContentKey(
    taggedFilePath,
    text,
    sourceFileNotFound,
  );
  const result = await getStructsByContent(
    runtime,
    contentKey,
    text,
    sourceFileNotFound,
  );
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
      imports: [...member.imports],
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
      imports: [...member.imports],
      parameters: cloneParameters(member),
    };
  }
  return {
    kind: member.kind,
    name: member.name,
    type: member.type,
    imports: [...member.imports],
    ...(member.isStatic ? { isStatic: true } : {}),
    ...(member.fieldNullability
      ? { fieldNullability: member.fieldNullability }
      : {}),
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
    imports: member.imports,
    ...('isStatic' in member && member.isStatic ? { isStatic: true } : {}),
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

interface AndroidApiOverloadIdentityMember {
  kind: AndroidApiMemberResult['kind'];
  name: string;
  parameters?: readonly { type: string }[];
}

export const getAndroidApiOverloadId = (
  member: AndroidApiOverloadIdentityMember,
): string => {
  if (member.parameters) {
    return `${member.kind}:${member.name}(${member.parameters
      .map((parameter) => parameter.type)
      .join(',')})`;
  }
  return `${member.kind}:${member.name}`;
};

const toSemanticKey = (version: InternalAndroidApiVersionResult): string => {
  return JSON.stringify({
    missingReason: version.missingReason,
    members: version.members?.map(toSemanticMember),
  });
};

const normalizeVersionImports = (
  versions: InternalAndroidApiVersionResult[],
): string[] => {
  const usedImports = new Set<string>();
  for (const version of versions) {
    for (const member of version.members ?? []) {
      for (const index of member.imports) {
        const value = version.imports[index];
        if (value === undefined) {
          throw new Error(`Invalid member import index: ${index}`);
        }
        usedImports.add(value);
      }
    }
  }
  const imports = Array.from(usedImports).sort();
  const importIndexes = new Map(
    imports.map((value, index) => [value, index] as const),
  );
  for (const version of versions) {
    for (const member of version.members ?? []) {
      member.imports = Array.from(
        new Set(
          member.imports.map((index) => {
            const value = version.imports[index]!;
            return importIndexes.get(value)!;
          }),
        ),
      ).sort((a, b) => a - b);
    }
    version.imports = imports;
  }
  return imports;
};

export interface AndroidApiMemberVersionRangeInput extends AndroidApiVersionRange {
  missingReason?: AndroidApiMissingReason;
  members?: AndroidApiMemberResult[];
}

const toRange = (
  version: InternalAndroidApiVersionResult,
): AndroidApiMemberVersionRangeInput => {
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
  range: AndroidApiMemberVersionRangeInput,
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
  ranges: AndroidApiVersionRange[],
  versions: Array<{
    version: string;
    apiVersion: number;
    tag: string;
  }>,
) => {
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
): AndroidApiMemberVersionRangeInput[] => {
  const ranges: AndroidApiMemberVersionRangeInput[] = [];
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

const toOverloadRange = (
  range: AndroidApiMemberVersionRangeInput,
  overloadId: string,
): AndroidApiOverloadVersionRangeResult => {
  const member = range.members?.find(
    (candidate) => getAndroidApiOverloadId(candidate) === overloadId,
  );
  const missingReason =
    range.missingReason ?? (member ? undefined : 'overload-not-found');
  return {
    fromVersion: range.fromVersion,
    fromAlias: range.fromAlias,
    fromApiVersion: range.fromApiVersion,
    fromTag: range.fromTag,
    ...(range.fromTagPosition
      ? { fromTagPosition: range.fromTagPosition }
      : {}),
    toVersion: range.toVersion,
    toAlias: range.toAlias,
    toApiVersion: range.toApiVersion,
    toTag: range.toTag,
    ...(range.toTagPosition ? { toTagPosition: range.toTagPosition } : {}),
    ...(missingReason ? { missingReason } : {}),
    ...(member ? { member } : {}),
  };
};

const toOverloadSemanticKey = (
  range: AndroidApiOverloadVersionRangeResult,
): string => {
  return JSON.stringify({
    missingReason: range.missingReason,
    member: range.member ? toSemanticMember(range.member) : undefined,
  });
};

const compactOverloadRanges = (
  ranges: readonly AndroidApiMemberVersionRangeInput[],
  overloadId: string,
): AndroidApiOverloadVersionRangeResult[] => {
  const result: AndroidApiOverloadVersionRangeResult[] = [];
  let previousKey = '';
  for (const range of ranges) {
    const next = toOverloadRange(range, overloadId);
    const key = toOverloadSemanticKey(next);
    const previous = result.at(-1);
    if (previous && key === previousKey) {
      previous.toVersion = next.toVersion;
      previous.toAlias = next.toAlias;
      previous.toApiVersion = next.toApiVersion;
      previous.toTag = next.toTag;
      if (next.toTagPosition) {
        previous.toTagPosition = next.toTagPosition;
      } else {
        delete previous.toTagPosition;
      }
      if (next.member) previous.member = next.member;
    } else {
      result.push(next);
      previousKey = key;
    }
  }
  return result;
};

export const normalizeAndroidApiMemberRanges = (
  memberRanges: readonly AndroidApiMemberVersionRangeInput[],
): {
  ranges: AndroidApiVersionRangeResult[];
  overloads: AndroidApiOverloadResult[];
} => {
  const sortedMemberRanges = [...memberRanges].sort(
    (a, b) =>
      a.fromApiVersion - b.fromApiVersion ||
      getTagRevision(a.fromTag) - getTagRevision(b.fromTag) ||
      a.fromTag.localeCompare(b.fromTag),
  );
  const latestMembers = new Map<string, AndroidApiMemberResult>();
  for (const range of sortedMemberRanges) {
    for (const member of range.members ?? []) {
      latestMembers.set(getAndroidApiOverloadId(member), member);
    }
  }
  const overloads = Array.from(latestMembers, ([overloadId, member]) => ({
    overloadId,
    signature: member.type,
    member,
    ranges: compactOverloadRanges(sortedMemberRanges, overloadId),
  })).sort(
    (a, b) =>
      ('parameters' in a.member ? a.member.parameters.length : 0) -
        ('parameters' in b.member ? b.member.parameters.length : 0) ||
      a.overloadId.localeCompare(b.overloadId),
  );
  const ranges = sortedMemberRanges.map(({ members, ...range }) => ({
    ...range,
    ...(members
      ? {
          overloadIds: members.map(getAndroidApiOverloadId),
        }
      : {}),
  }));
  return { ranges, overloads };
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
      package: '',
      imports: [],
      summary: {
        checkedTags: 0,
        foundTags: 0,
        rangeCount: 0,
        overloadCount: 0,
      },
      ranges: [],
      overloads: [],
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
          const { file, sourceFileNotFound } = await getStructsByTaggedFile(
            runtime,
            taggedFilePath,
            options.signal,
          );
          options.signal?.throwIfAborted();
          let targetFound = false;
          let members: AndroidApiMemberResult[] | undefined;
          let typePath: AndroidApiResolvedType[] | undefined;

          if (!sourceFileNotFound) {
            if (search.targetKind === 'file') {
              targetFound = true;
            } else if (search.targetKind === 'class') {
              const foundTypePath = findStructPathByPath(
                file.structs,
                search.targetPaths,
              );
              if (foundTypePath) {
                targetFound = true;
                typePath = foundTypePath.map(toAndroidApiResolvedType);
              }
            } else {
              const propName = search.targetPaths.at(-1);
              const foundTypePath = findStructPathByPath(
                file.structs,
                search.targetPaths.slice(0, -1),
              );
              const foundTarget = foundTypePath?.at(-1);
              if (foundTypePath && foundTarget && propName) {
                typePath = foundTypePath.map(toAndroidApiResolvedType);
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
            package: file.package,
            imports: file.imports,
            ...(missingReason ? { missingReason } : {}),
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

  const imports = normalizeVersionImports(versions);
  const foundVersions = versions.filter((v) => !v.missingReason);
  const memberRanges = compactVersionResults(versions);
  const { ranges, overloads } = normalizeAndroidApiMemberRanges(memberRanges);
  const typePath = versions.findLast((version) => version.typePath)?.typePath;
  const result: AndroidApiQueryResult = {
    apiName: options.apiName,
    normalizedApiName,
    package: versions.findLast((version) => version.package)?.package ?? '',
    imports,
    source: resolution.source,
    resolvedTarget: {
      ...resolution.resolvedTarget,
      ...(typePath ? { typePath } : {}),
    },
    summary: {
      checkedTags: versions.length,
      foundTags: foundVersions.length,
      rangeCount: ranges.length,
      overloadCount: overloads.length,
      firstFoundTag: foundVersions[0]?.tag,
      lastFoundTag: foundVersions.at(-1)?.tag,
    },
    ranges,
    overloads,
  };
  await runtime.queryCache?.set(cacheKey, result);
  return result;
};
