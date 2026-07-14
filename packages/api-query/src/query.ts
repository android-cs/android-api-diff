import type { ClassMember, ClassStruct } from '@android-cs/api-parser';
import { getAIDLStructList, getJavaStructList } from '@android-cs/api-parser';
import pLimit from 'p-limit';
import { DEFAULT_MIN_SDK } from './constants.ts';
import { loadAidlJavaFiles, loadAndroidVersionList } from './data.ts';
import { searchFilePathByRefName, toAndroidApiResolution } from './resolve.ts';
import { findStructByPath } from './struct.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiMissingReason,
  AndroidApiQueryResult,
  AndroidApiQueryRuntime,
  AndroidApiSourceProvider,
  AndroidApiStructCacheEntry,
  AndroidApiVersionRangeResult,
  AndroidVersionItem,
  QueryAndroidApiOptions,
} from './types.ts';
import { getGoogleContentUrl, getMirrorContentUrl } from './url.ts';

export const STRUCT_CACHE_VERSION = 'struct:v6';
export const QUERY_CACHE_VERSION = 'query:v15';
const DEFAULT_CONCURRENCY = 3;

interface InternalAndroidApiVersionResult {
  version: string;
  alias: string;
  apiVersion: number;
  tag: string;
  missingReason?: AndroidApiMissingReason;
  signature?: string;
  members?: AndroidApiMemberResult[];
}

const normalizeConcurrency = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return DEFAULT_CONCURRENCY;
  }
  return Math.floor(value);
};

const getCachedText = async (
  runtime: AndroidApiQueryRuntime,
  key: string,
  url: string,
): Promise<string> => {
  const cached = await runtime.textCache?.get(key);
  if (cached !== undefined) return cached;
  const text = await runtime.fetchText(url);
  await runtime.textCache?.set(key, text);
  return text;
};

const getSourceProvider = (
  runtime: AndroidApiQueryRuntime,
): AndroidApiSourceProvider => {
  return runtime.sourceProvider ?? 'github';
};

const decodeGoogleSourceText = (text: string): string => {
  const binary = atob(text.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const getTaggedFileText = async (
  runtime: AndroidApiQueryRuntime,
  sourceProvider: AndroidApiSourceProvider,
  taggedFilePath: string,
): Promise<{ text: string; sourceFileNotFound: boolean }> => {
  const url =
    sourceProvider === 'googlesource'
      ? getGoogleContentUrl(taggedFilePath)
      : getMirrorContentUrl(taggedFilePath);
  const rawText = await getCachedText(
    runtime,
    `raw:${sourceProvider}:${url}`,
    url,
  );
  if (sourceProvider === 'googlesource') {
    const sourceFileNotFound =
      rawText.startsWith('NOT_FOUND:') || rawText.startsWith('404:');
    return {
      text: sourceFileNotFound ? rawText : decodeGoogleSourceText(rawText),
      sourceFileNotFound,
    };
  }
  return {
    text: rawText,
    sourceFileNotFound: rawText.startsWith('404:'),
  };
};

const getStructsByTaggedFile = async (
  runtime: AndroidApiQueryRuntime,
  sourceProvider: AndroidApiSourceProvider,
  taggedFilePath: string,
): Promise<AndroidApiStructCacheEntry> => {
  const structKey = `${STRUCT_CACHE_VERSION}:${sourceProvider}:${taggedFilePath}`;
  const cached = await runtime.structCache?.get(structKey);
  if (cached) return cached;

  const { text, sourceFileNotFound } = await getTaggedFileText(
    runtime,
    sourceProvider,
    taggedFilePath,
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
  return ranges;
};

const getQueryCacheKey = (
  options: QueryAndroidApiOptions,
  sourceProvider: AndroidApiSourceProvider,
): string => {
  return [
    QUERY_CACHE_VERSION,
    sourceProvider,
    options.apiName.trim(),
    options.minSdk ?? '',
  ].join(':');
};

export const queryAndroidApi = async (
  runtime: AndroidApiQueryRuntime,
  options: QueryAndroidApiOptions,
): Promise<AndroidApiQueryResult> => {
  const normalizedApiName = options.apiName.trim();
  const sourceProvider = getSourceProvider(runtime);
  const cacheKey = getQueryCacheKey(
    { ...options, apiName: normalizedApiName },
    sourceProvider,
  );
  const cached = await runtime.queryCache?.get(cacheKey);
  if (cached) return cached;

  const aidlJavaFiles = await loadAidlJavaFiles(runtime);
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

  const resolution = toAndroidApiResolution(search)!;
  const androidVersionList = getSelectedTags(
    await loadAndroidVersionList(runtime),
    options,
  );
  const limit = pLimit(normalizeConcurrency(options.concurrency));
  const versions = (
    await Promise.all(
      androidVersionList.flatMap((version) =>
        version.tags.map((tag) =>
          limit(async (): Promise<InternalAndroidApiVersionResult> => {
            const taggedFilePath = `${tag}/${search.filePath}`;
            const { structs, sourceFileNotFound } =
              await getStructsByTaggedFile(
                runtime,
                sourceProvider,
                taggedFilePath,
              );
            let targetFound = false;
            let members: AndroidApiMemberResult[] | undefined;
            let signature = '';

            if (!sourceFileNotFound) {
              if (search.targetKind === 'file') {
                targetFound = true;
              } else if (search.targetKind === 'class') {
                const foundTarget = findStructByPath(
                  structs,
                  search.targetPaths,
                );
                if (foundTarget) {
                  targetFound = true;
                }
              } else {
                const propName = search.targetPaths.at(-1);
                const foundTarget = findStructByPath(
                  structs,
                  search.targetPaths.slice(0, -1),
                );
                if (foundTarget && propName) {
                  const matchedMembers = foundTarget.members.filter(
                    (v) => v.name === propName,
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

            return {
              version: version.version,
              alias: version.alias,
              apiVersion: version.apiVersion,
              tag,
              ...(missingReason ? { missingReason } : {}),
              ...(signature ? { signature } : {}),
              members,
            };
          }),
        ),
      ),
    )
  ).sort(compareVersionResults);

  const foundVersions = versions.filter((v) => !v.missingReason);
  const ranges = compactVersionResults(versions);
  const signatures = Array.from(
    new Set(foundVersions.flatMap((v) => (v.signature ? [v.signature] : []))),
  );
  const result: AndroidApiQueryResult = {
    apiName: options.apiName,
    normalizedApiName,
    source: resolution.source,
    resolvedTarget: resolution.resolvedTarget,
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
