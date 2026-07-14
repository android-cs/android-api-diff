import type {
  ClassMemberParam,
  ClassStruct,
  Nullability,
} from '@android-cs/api-parser';

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
  filePath: string;
  targetUrl: string;
  targetPaths: string[];
  targetKind: SearchTargetKind;
}

export interface AndroidApiSourceLocation {
  repo: 'platform/frameworks/base';
  path: string;
}

export interface AndroidApiResolvedTarget {
  kind: SearchTargetKind;
  paths: string[];
}

export interface AndroidApiResolution {
  source: AndroidApiSourceLocation;
  resolvedTarget: AndroidApiResolvedTarget;
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
  concurrency?: number;
}

export type AndroidApiMemberResult =
  | {
      kind: 'field' | 'constant';
      name: string;
      type: string;
      fieldNullability?: Nullability;
    }
  | {
      kind: 'method';
      name: string;
      type: string;
      returnType: string;
      returnNullability?: Nullability;
      parameters: ClassMemberParam[];
    }
  | {
      kind: 'constructor';
      name: string;
      type: string;
      parameters: ClassMemberParam[];
    };

export interface AndroidApiStructCacheEntry {
  structs: ClassStruct[];
  sourceFileNotFound: boolean;
}

export type AndroidApiMissingReason = 'source-file-not-found' | 'api-not-found';

export interface AndroidApiVersionRangeResult {
  fromVersion: string;
  fromAlias: string;
  fromApiVersion: number;
  fromTag: string;
  toVersion: string;
  toAlias: string;
  toApiVersion: number;
  toTag: string;
  missingReason?: AndroidApiMissingReason;
  members?: AndroidApiMemberResult[];
}

export interface AndroidApiQueryResult {
  apiName: string;
  normalizedApiName: string;
  source?: AndroidApiSourceLocation;
  resolvedTarget?: AndroidApiResolvedTarget;
  summary: {
    checkedTags: number;
    foundTags: number;
    rangeCount: number;
    firstFoundTag?: string;
    lastFoundTag?: string;
    signatures: string[];
  };
  ranges: AndroidApiVersionRangeResult[];
}
