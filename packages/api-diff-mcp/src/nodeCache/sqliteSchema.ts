import { DatabaseSync, type StatementSync } from 'node:sqlite';
import {
  CACHE_BLOB_CODEC,
  CACHE_CONNECTION_EPOCH,
  CACHE_FORMAT_VERSION,
  MAX_CACHE_PAYLOAD_BYTES,
  NODE_CACHE_VERSIONS,
  type NodeCacheDomain,
  SQLITE_BUSY_TIMEOUT_MS,
} from './constants.ts';

export interface CacheBlobRow extends Record<string, unknown> {
  contentHash: unknown;
  generation: unknown;
  payload: unknown;
  payloadSize: unknown;
  rawSize: unknown;
}

export interface PreparedStatements {
  deleteBlob: StatementSync;
  deleteOrphanBlob: StatementSync;
  deleteRef: StatementSync;
  hasBlob: StatementSync;
  insertBlob: StatementSync;
  readRefContentHash: StatementSync;
  readRef: StatementSync;
  upsertRef: StatementSync;
}

export interface PreparedDatabase {
  assertCurrentConnection(): void;
  database: DatabaseSync;
  statements: Record<NodeCacheDomain, PreparedStatements>;
}

interface CacheDomainSchema {
  blobTable: string;
  refTable: string;
  versionKey: MetaKey;
}

type MetaKey =
  | 'blob_codec'
  | 'cache_epoch'
  | 'query_version'
  | 'struct_version'
  | 'text_version';

const DOMAIN_ORDER: readonly NodeCacheDomain[] = ['text', 'struct', 'query'];

const DOMAIN_SCHEMAS = {
  query: {
    blobTable: 'query_blobs',
    refTable: 'query_refs',
    versionKey: 'query_version',
  },
  struct: {
    blobTable: 'struct_blobs',
    refTable: 'struct_refs',
    versionKey: 'struct_version',
  },
  text: {
    blobTable: 'text_blobs',
    refTable: 'text_refs',
    versionKey: 'text_version',
  },
} as const satisfies Record<NodeCacheDomain, CacheDomainSchema>;

const EXPECTED_META: Record<MetaKey, string> = {
  blob_codec: CACHE_BLOB_CODEC,
  cache_epoch: String(CACHE_CONNECTION_EPOCH),
  query_version: NODE_CACHE_VERSIONS.query,
  struct_version: NODE_CACHE_VERSIONS.struct,
  text_version: NODE_CACHE_VERSIONS.text,
};

const META_KEYS = Object.keys(EXPECTED_META) as MetaKey[];
const EXPECTED_TABLE_NAMES = [
  'meta',
  'text_blobs',
  'text_refs',
  'struct_blobs',
  'struct_refs',
  'query_blobs',
  'query_refs',
] as const;

const CREATE_SCHEMA_SQL = `
  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE text_blobs (
    content_hash TEXT PRIMARY KEY NOT NULL,
    generation TEXT NOT NULL,
    raw_size INTEGER NOT NULL CHECK (raw_size >= 0),
    payload BLOB NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE text_refs (
    key_hash TEXT PRIMARY KEY NOT NULL,
    content_hash TEXT NOT NULL,
    FOREIGN KEY (content_hash)
      REFERENCES text_blobs (content_hash)
      ON DELETE CASCADE
  ) WITHOUT ROWID;

  CREATE INDEX text_refs_by_content ON text_refs (content_hash);

  CREATE TABLE struct_blobs (
    content_hash TEXT PRIMARY KEY NOT NULL,
    generation TEXT NOT NULL,
    raw_size INTEGER NOT NULL CHECK (raw_size >= 0),
    payload BLOB NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE struct_refs (
    key_hash TEXT PRIMARY KEY NOT NULL,
    content_hash TEXT NOT NULL,
    FOREIGN KEY (content_hash)
      REFERENCES struct_blobs (content_hash)
      ON DELETE CASCADE
  ) WITHOUT ROWID;

  CREATE INDEX struct_refs_by_content ON struct_refs (content_hash);

  CREATE TABLE query_blobs (
    content_hash TEXT PRIMARY KEY NOT NULL,
    generation TEXT NOT NULL,
    raw_size INTEGER NOT NULL CHECK (raw_size >= 0),
    payload BLOB NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE query_refs (
    key_hash TEXT PRIMARY KEY NOT NULL,
    content_hash TEXT NOT NULL,
    FOREIGN KEY (content_hash)
      REFERENCES query_blobs (content_hash)
      ON DELETE CASCADE
  ) WITHOUT ROWID;

  CREATE INDEX query_refs_by_content ON query_refs (content_hash);
`;

const readUserVersion = (database: DatabaseSync): number => {
  const value = database.prepare('PRAGMA user_version').get()?.user_version;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Invalid SQLite cache format version');
  }
  return value;
};

const readStoredEpoch = (database: DatabaseSync): bigint | undefined => {
  const hasMeta = database
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
    )
    .get();
  if (!hasMeta) return;

  let value: unknown;
  try {
    value = database
      .prepare("SELECT value FROM meta WHERE key = 'cache_epoch'")
      .get()?.value;
  } catch {
    return;
  }
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) return;
  return BigInt(value);
};

const assertNotNewer = (
  userVersion: number,
  storedEpoch: bigint | undefined,
): void => {
  if (userVersion > CACHE_FORMAT_VERSION) {
    throw new Error('SQLite cache format is newer than this binary');
  }
  if (
    storedEpoch !== undefined &&
    storedEpoch > BigInt(CACHE_CONNECTION_EPOCH)
  ) {
    throw new Error('SQLite cache epoch is newer than this binary');
  }
};

const hasExpectedSchema = (database: DatabaseSync): boolean => {
  const rows = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all();
  const names = new Set(rows.map((row) => row.name));
  return EXPECTED_TABLE_NAMES.every((name) => names.has(name));
};

const dropAndCreateSchema = (database: DatabaseSync): void => {
  database.exec(`
    DROP TABLE IF EXISTS text_refs;
    DROP TABLE IF EXISTS struct_refs;
    DROP TABLE IF EXISTS query_refs;
    DROP TABLE IF EXISTS text_blobs;
    DROP TABLE IF EXISTS struct_blobs;
    DROP TABLE IF EXISTS query_blobs;
    DROP TABLE IF EXISTS meta;
    ${CREATE_SCHEMA_SQL}
    PRAGMA user_version = ${CACHE_FORMAT_VERSION};
  `);
};

const readMeta = (database: DatabaseSync): Record<MetaKey, unknown> => {
  const statement = database.prepare('SELECT value FROM meta WHERE key = ?');
  return Object.fromEntries(
    META_KEYS.map((key) => [key, statement.get(key)?.value]),
  ) as Record<MetaKey, unknown>;
};

const writeExpectedMeta = (
  database: DatabaseSync,
  currentMeta: Record<MetaKey, unknown> = {} as Record<MetaKey, unknown>,
): void => {
  const statement = database.prepare(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `);
  for (const key of META_KEYS) {
    if (currentMeta[key] !== EXPECTED_META[key]) {
      statement.run(key, EXPECTED_META[key]);
    }
  }
};

const reconcileLogicalVersions = (database: DatabaseSync): void => {
  const currentMeta = readMeta(database);
  const resetAll = currentMeta.blob_codec !== EXPECTED_META.blob_codec;

  for (const domain of DOMAIN_ORDER) {
    const schema = DOMAIN_SCHEMAS[domain];
    if (
      resetAll ||
      currentMeta[schema.versionKey] !== EXPECTED_META[schema.versionKey]
    ) {
      database.exec(`
        DELETE FROM ${schema.refTable};
        DELETE FROM ${schema.blobTable};
      `);
    }
  }
  writeExpectedMeta(database, currentMeta);
};

const initializeDatabase = (database: DatabaseSync): void => {
  const initialUserVersion = readUserVersion(database);
  assertNotNewer(initialUserVersion, readStoredEpoch(database));

  database.exec('PRAGMA journal_mode = WAL');
  database.exec('BEGIN IMMEDIATE');
  try {
    const userVersion = readUserVersion(database);
    const storedEpoch = readStoredEpoch(database);
    assertNotNewer(userVersion, storedEpoch);

    if (userVersion < CACHE_FORMAT_VERSION || !hasExpectedSchema(database)) {
      dropAndCreateSchema(database);
      writeExpectedMeta(database);
    } else {
      reconcileLogicalVersions(database);
    }
    database.exec('COMMIT');
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw error;
  }
};

const prepareDomainStatements = (
  database: DatabaseSync,
  schema: CacheDomainSchema,
): PreparedStatements => {
  const { blobTable, refTable } = schema;
  return {
    deleteBlob: database.prepare(`
      DELETE FROM ${blobTable}
      WHERE content_hash = ? AND generation = ?
    `),
    deleteOrphanBlob: database.prepare(`
      DELETE FROM ${blobTable}
      WHERE content_hash = ?
        AND NOT EXISTS (
          SELECT 1
          FROM ${refTable}
          WHERE ${refTable}.content_hash = ${blobTable}.content_hash
        )
    `),
    deleteRef: database.prepare(`
      DELETE FROM ${refTable}
      WHERE key_hash = ?
        AND (? IS NULL OR content_hash = ?)
    `),
    hasBlob: database.prepare(`
      SELECT 1
      FROM ${blobTable}
      WHERE content_hash = ?
    `),
    insertBlob: database.prepare(`
      INSERT OR IGNORE INTO ${blobTable} (
        content_hash, generation, raw_size, payload
      ) VALUES (?, ?, ?, ?)
    `),
    readRef: database.prepare(`
      SELECT
        ${refTable}.content_hash AS contentHash,
        ${blobTable}.generation AS generation,
        ${blobTable}.raw_size AS rawSize,
        length(${blobTable}.payload) AS payloadSize,
        CASE
          WHEN length(${blobTable}.payload) <= ${MAX_CACHE_PAYLOAD_BYTES}
          THEN ${blobTable}.payload
          ELSE NULL
        END AS payload
      FROM ${refTable}
      LEFT JOIN ${blobTable}
        ON ${blobTable}.content_hash = ${refTable}.content_hash
      WHERE ${refTable}.key_hash = ?
    `),
    readRefContentHash: database.prepare(`
      SELECT content_hash AS contentHash
      FROM ${refTable}
      WHERE key_hash = ?
    `),
    upsertRef: database.prepare(`
      INSERT INTO ${refTable} (key_hash, content_hash)
      VALUES (?, ?)
      ON CONFLICT (key_hash)
      DO UPDATE SET content_hash = excluded.content_hash
    `),
  };
};

const prepareStatements = (
  database: DatabaseSync,
): Record<NodeCacheDomain, PreparedStatements> => ({
  query: prepareDomainStatements(database, DOMAIN_SCHEMAS.query),
  struct: prepareDomainStatements(database, DOMAIN_SCHEMAS.struct),
  text: prepareDomainStatements(database, DOMAIN_SCHEMAS.text),
});

const prepareConnectionFence = (database: DatabaseSync): (() => void) => {
  const readEpoch = database.prepare(
    "SELECT value FROM meta WHERE key = 'cache_epoch'",
  );
  const readFormat = database.prepare('PRAGMA user_version');
  return () => {
    const userVersion = readFormat.get()?.user_version;
    const epoch = readEpoch.get()?.value;
    if (
      userVersion !== CACHE_FORMAT_VERSION ||
      epoch !== String(CACHE_CONNECTION_EPOCH)
    ) {
      throw new Error('SQLite cache connection is stale');
    }
  };
};

export const openCacheDatabase = (databasePath: string): PreparedDatabase => {
  const database = new DatabaseSync(databasePath, {
    enableForeignKeyConstraints: true,
    timeout: SQLITE_BUSY_TIMEOUT_MS,
  });

  try {
    database.exec(`
      PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};
      PRAGMA foreign_keys = ON;
    `);
    initializeDatabase(database);
    return {
      assertCurrentConnection: prepareConnectionFence(database),
      database,
      statements: prepareStatements(database),
    };
  } catch (error) {
    if (database.isOpen) database.close();
    throw error;
  }
};
