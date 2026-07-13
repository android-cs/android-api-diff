import type { ClassMember, ClassStruct } from '@android-cs/api-parser';

export interface AndroidVersionInfo {
  version: string;
  alias: string;
  apiVersion: number;
}

export interface AndroidVersionItem extends AndroidVersionInfo {
  tags: string[];
  futureTags: string[];
}

export interface VersionUrlBuilder {
  filePath: string;
  templateUrl: [string, string];
}

export type SearchTargetKind = 'file' | 'class' | 'member';

export interface SearchFromData {
  targetUrl: string;
  targetPaths: string[];
  targetKind: SearchTargetKind;
}

export interface FileTarget {
  filePath: string;
  targetPaths: string[];
}

export interface CacheStore<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
}

export type AndroidApiSourceProvider = 'github' | 'googlesource';

export interface AndroidApiQueryRuntime {
  fetchText(url: string): Promise<string>;
  sourceProvider?: AndroidApiSourceProvider;
  loadAidlJavaFiles?(): Promise<string[]>;
  loadAndroidVersionList?(): Promise<AndroidVersionItem[]>;
  textCache?: CacheStore<string>;
  structCache?: CacheStore<AndroidApiStructCacheEntry>;
  queryCache?: CacheStore<AndroidApiQueryResult>;
}

export interface QueryAndroidApiOptions {
  apiName: string;
  minSdk?: number;
  maxSdk?: number;
  tagStrategy?: 'latest-per-version' | 'all';
  concurrency?: number;
}

export type AndroidApiMemberResult = ClassMember & {
  sourceUrl: string;
};

export interface AndroidApiStructResult {
  name: string;
  loc: number;
  memberCount: number;
  childCount: number;
  sourceUrl: string;
}

export interface AndroidApiStructCacheEntry {
  structs: ClassStruct[];
  sourceFileNotFound: boolean;
}

export type AndroidApiMissingReason =
  | 'source-file-not-found'
  | 'api-not-found';

export interface AndroidApiVersionResult {
  version: string;
  alias: string;
  apiVersion: number;
  tag: string;
  missingReason?: AndroidApiMissingReason;
  typeDesc?: string;
  sourceUrl: string;
  target?: AndroidApiStructResult;
  members?: AndroidApiMemberResult[];
}

export interface AndroidApiQueryResult {
  apiName: string;
  normalizedApiName: string;
  search?: SearchFromData;
  summary: {
    checkedTags: number;
    foundTags: number;
    firstFoundTag?: string;
    lastFoundTag?: string;
    signatures: string[];
  };
  versions: AndroidApiVersionResult[];
}
