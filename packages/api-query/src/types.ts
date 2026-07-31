import type {
  ApiFile,
  ClassMemberParam,
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
  /** Raw source URL template. Replace `:tag` with an Android release tag. */
  url: string;
}

export interface AndroidApiResolvedTarget {
  kind: SearchTargetKind;
  paths: string[];
  typePath?: AndroidApiResolvedType[];
}

export interface AndroidApiResolvedType {
  name: string;
  kind: 'class' | 'interface';
  isAbstract?: true;
  isHidden: boolean;
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
  /**
   * Returns the canonical in-memory instance for this serialized value when
   * the store supports content-based object reuse.
   */
  intern?(value: T): T;
}

/** @deprecated Source-file downloads always use GitHub. */
export type AndroidApiSourceProvider =
  | 'github'
  | 'googlesource'
  | 'github-googlesource';

export interface AndroidApiQueryRuntime {
  fetchText(url: string, signal?: AbortSignal): Promise<string>;
  /** @deprecated Ignored. Source-file downloads always use GitHub. */
  sourceProvider?: AndroidApiSourceProvider;
  loadAidlJavaFiles?(signal?: AbortSignal): Promise<string[]>;
  loadAndroidVersionList?(signal?: AbortSignal): Promise<AndroidVersionItem[]>;
  textCache?: CacheStore<string>;
  structCache?: CacheStore<AndroidApiStructCacheEntry>;
  queryCache?: CacheStore<AndroidApiQueryResult>;
}

export interface QueryAndroidApiOptions {
  apiName: string;
  minSdk?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?(progress: AndroidApiQueryProgress): void | Promise<void>;
}

export interface AndroidApiQueryProgress {
  completedTags: number;
  totalTags: number;
  currentTag?: string;
}

export type AndroidApiMemberResult =
  | {
      kind: 'field' | 'constant';
      name: string;
      type: string;
      imports: number[];
      isStatic?: true;
      fieldNullability?: Nullability;
    }
  | {
      kind: 'method';
      name: string;
      type: string;
      imports: number[];
      isAbstract?: true;
      returnType: string;
      returnNullability?: Nullability;
      parameters: ClassMemberParam[];
    }
  | {
      kind: 'constructor';
      name: string;
      type: string;
      imports: number[];
      parameters: ClassMemberParam[];
    };

export interface AndroidApiStructCacheEntry {
  file: ApiFile;
  sourceFileNotFound: boolean;
}

export type AndroidApiMissingReason = 'source-file-not-found' | 'api-not-found';

export type AndroidApiOverloadMissingReason =
  | AndroidApiMissingReason
  | 'overload-not-found';

export interface AndroidApiVersionRange {
  fromVersion: string;
  fromAlias: string;
  fromApiVersion: number;
  fromTag: string;
  /** The endpoint is the first tag checked for this Android version in this query snapshot. */
  fromTagPosition?: 'first-checked';
  toVersion: string;
  toAlias: string;
  toApiVersion: number;
  toTag: string;
  /** The endpoint is the last tag checked in this query snapshot, not a permanent final tag. */
  toTagPosition?: 'last-checked';
}

export interface AndroidApiVersionRangeResult extends AndroidApiVersionRange {
  missingReason?: AndroidApiMissingReason;
  /** Stable overload identities available throughout this range. */
  overloadIds?: string[];
}

export interface AndroidApiOverloadVersionRangeResult extends AndroidApiVersionRange {
  missingReason?: AndroidApiOverloadMissingReason;
  member?: AndroidApiMemberResult;
}

export interface AndroidApiOverloadResult {
  /** Java overload identity: member kind, name, and parameter types. */
  overloadId: string;
  /** Full signature from the latest checked definition of this overload. */
  signature: string;
  /** Latest checked definition of this overload. */
  member: AndroidApiMemberResult;
  ranges: AndroidApiOverloadVersionRangeResult[];
}

export interface AndroidApiQueryResult {
  apiName: string;
  normalizedApiName: string;
  package: string;
  imports: string[];
  source?: AndroidApiSourceLocation;
  resolvedTarget?: AndroidApiResolvedTarget;
  summary: {
    checkedTags: number;
    foundTags: number;
    rangeCount: number;
    overloadCount: number;
    firstFoundTag?: string;
    lastFoundTag?: string;
  };
  ranges: AndroidApiVersionRangeResult[];
  overloads: AndroidApiOverloadResult[];
}

export interface AndroidApiCodeDeclaration {
  member: AndroidApiMemberResult;
  signature: string;
  remapMethodName?: string;
  requiresApi: AndroidVersionInfo;
  deprecatedSinceApi?: AndroidVersionInfo;
  fromTag: string;
  toTag: string;
}

export interface AndroidApiCodeResult {
  apiName: string;
  normalizedApiName: string;
  package: string;
  imports: string[];
  source?: AndroidApiSourceLocation;
  resolvedTarget?: AndroidApiResolvedTarget;
  summary: {
    checkedTags: number;
    foundTags: number;
    declarationCount: number;
    overloadCount: number;
    firstFoundTag?: string;
    lastFoundTag?: string;
  };
  declarations: AndroidApiCodeDeclaration[];
  code: string;
}
