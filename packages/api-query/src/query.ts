import type { ClassStruct } from '@android-cs/api-parser';
import { getAIDLStructList, getJavaStructList } from '@android-cs/api-parser';
import pLimit from 'p-limit';
import { DEFAULT_MIN_SDK } from './constants.ts';
import { loadAidlJavaFiles, loadAndroidVersionList } from './data.ts';
import { searchFilePathByRefName } from './resolve.ts';
import { findStructByPath } from './struct.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiQueryResult,
  AndroidApiQueryRuntime,
  AndroidApiSourceProvider,
  AndroidApiStructCacheEntry,
  AndroidApiStructResult,
  AndroidApiVersionResult,
  AndroidVersionItem,
  QueryAndroidApiOptions,
} from './types.ts';
import {
  getGoogleContentUrl,
  getGoogleSourceUrl,
  getMirrorContentUrl,
  getSourceUrlWithLine,
  getVersionUrlBuilder,
} from './url.ts';

export const STRUCT_CACHE_VERSION = 'struct:v5';
export const QUERY_CACHE_VERSION = 'query:v8';
const DEFAULT_CONCURRENCY = 3;

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
  const maxSdk = options.maxSdk ?? Number.MAX_SAFE_INTEGER;
  return androidVersionList
    .filter((v) => v.apiVersion >= minSdk && v.apiVersion <= maxSdk)
    .map((version) => {
      const tags =
        options.tagStrategy === 'all' ? version.tags : version.tags.slice(-1);
      return { ...version, tags };
    })
    .filter((v) => v.tags.length > 0);
};

const toResultTarget = (
  target: ClassStruct,
  sourceUrl: string,
): AndroidApiStructResult => {
  return {
    name: target.name,
    loc: target.loc,
    memberCount: target.members.length,
    childCount: target.children?.length ?? 0,
    sourceUrl: getSourceUrlWithLine(sourceUrl, target.loc),
  };
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
    options.maxSdk ?? '',
    options.tagStrategy ?? 'latest-per-version',
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
        signatures: [],
      },
      versions: [],
    };
    await runtime.queryCache?.set(cacheKey, result);
    return result;
  }

  const builder = getVersionUrlBuilder(search.targetUrl);
  if (!builder?.filePath) {
    const result: AndroidApiQueryResult = {
      apiName: options.apiName,
      normalizedApiName,
      search,
      summary: {
        checkedTags: 0,
        foundTags: 0,
        signatures: [],
      },
      versions: [],
    };
    await runtime.queryCache?.set(cacheKey, result);
    return result;
  }

  const androidVersionList = getSelectedTags(
    await loadAndroidVersionList(runtime),
    options,
  );
  const limit = pLimit(normalizeConcurrency(options.concurrency));
  const versions = (
    await Promise.all(
      androidVersionList.flatMap((version) =>
        version.tags.map((tag) =>
          limit(async (): Promise<AndroidApiVersionResult> => {
            const taggedFilePath = tag + builder.filePath;
            const { structs, sourceFileNotFound } =
              await getStructsByTaggedFile(
                runtime,
                sourceProvider,
                taggedFilePath,
              );
            const sourceUrl = getGoogleSourceUrl(taggedFilePath);
            let target: AndroidApiStructResult | undefined;
            let members: AndroidApiMemberResult[] | undefined;
            let typeDesc = '';

            if (!sourceFileNotFound) {
              if (search.targetKind === 'file') {
                typeDesc = 'file';
              } else if (search.targetKind === 'class') {
                const foundTarget = findStructByPath(
                  structs,
                  search.targetPaths,
                );
                if (foundTarget) {
                  target = toResultTarget(foundTarget, sourceUrl);
                  typeDesc = 'class';
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
                    target = toResultTarget(foundTarget, sourceUrl);
                    members = matchedMembers
                      .sort(
                        (a, b) =>
                          (a.parameterCount ?? 0) - (b.parameterCount ?? 0),
                      )
                      .map((member) => ({
                        ...member,
                        sourceUrl: getSourceUrlWithLine(sourceUrl, member.loc),
                      }));
                    typeDesc = members.map((v) => v.type).join('\n');
                  }
                }
              }
            }

            const isApiFound =
              search.targetKind === 'file'
                ? !sourceFileNotFound
                : !!target || !!members?.length;
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
              ...(typeDesc ? { typeDesc } : {}),
              sourceUrl,
              target,
              members,
            };
          }),
        ),
      ),
    )
  ).sort((a, b) => a.apiVersion - b.apiVersion || a.tag.localeCompare(b.tag));

  const foundVersions = versions.filter((v) => !v.missingReason);
  const signatures = Array.from(
    new Set(foundVersions.flatMap((v) => (v.typeDesc ? [v.typeDesc] : []))),
  );
  const result: AndroidApiQueryResult = {
    apiName: options.apiName,
    normalizedApiName,
    search,
    summary: {
      checkedTags: versions.length,
      foundTags: foundVersions.length,
      firstFoundTag: foundVersions[0]?.tag,
      lastFoundTag: foundVersions.at(-1)?.tag,
      signatures,
    },
    versions,
  };
  await runtime.queryCache?.set(cacheKey, result);
  return result;
};
