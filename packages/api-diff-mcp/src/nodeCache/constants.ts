import {
  QUERY_CACHE_VERSION,
  STRUCT_CACHE_VERSION,
} from '@android-cs/api-query/query';

export const CACHE_DATABASE_FILENAME = 'cache-v2.sqlite';
export const CACHE_FORMAT_VERSION = 2;
export const CACHE_BLOB_CODEC = 'br1';
export const ETAG_CACHE_VERSION = '1';
export const BROTLI_QUALITY = 5;
export const MAX_CACHE_ENTRY_BYTES = 64 * 1024 * 1024;
export const MAX_CACHE_PAYLOAD_BYTES = MAX_CACHE_ENTRY_BYTES + 1024 * 1024;
export const SQLITE_BUSY_TIMEOUT_MS = 5_000;

export const LEGACY_CACHE_DIR_NAMES = ['text', 'struct', 'query'] as const;

export const NODE_CACHE_DOMAINS = {
  query: 'query',
  struct: 'struct',
  text: 'text',
} as const;

export type NodeCacheDomain =
  (typeof NODE_CACHE_DOMAINS)[keyof typeof NODE_CACHE_DOMAINS];

export const NODE_CACHE_VERSIONS = {
  query: `${QUERY_CACHE_VERSION}:1`,
  struct: `${STRUCT_CACHE_VERSION}:1`,
  text: '1',
} as const satisfies Record<NodeCacheDomain, string>;

const CACHE_VERSION_KEY =
  `${CACHE_FORMAT_VERSION}|${CACHE_BLOB_CODEC}|${NODE_CACHE_VERSIONS.text}|${NODE_CACHE_VERSIONS.struct}|${NODE_CACHE_VERSIONS.query}|${ETAG_CACHE_VERSION}` as const;

// Add a new key with a strictly larger value whenever any component in
// CACHE_VERSION_KEY changes. Keeping prior keys makes the monotonic history
// explicit and turns an unregistered version combination into a type error.
const CACHE_CONNECTION_EPOCHS = {
  '1|br1|1|struct:v9:1|query:v19:1': 1,
  '2|br1|1|struct:v9:1|query:v19:1|1': 2,
  '2|br1|1|struct:v9:1|query:v20:1|1': 3,
} as const;

export const CACHE_CONNECTION_EPOCH =
  CACHE_CONNECTION_EPOCHS[CACHE_VERSION_KEY];
