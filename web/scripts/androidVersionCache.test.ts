import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ANDROID_VERSION_CACHE_TTL,
  ANDROID_VERSION_CACHE_VERSION,
  loadCachedAndroidVersions,
} from '../src/utils/androidVersionCache.ts';

const data = [
  {
    version: '14',
    alias: 'U',
    apiVersion: 34,
    tags: ['android-14.0.0_r1'],
    futureTags: [],
  },
];

test('persists versions for seven days and refreshes expired, old, or corrupt caches', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'android-version-cache-'));
  const path = join(dir, 'nested', 'versions.json');
  let timestamp = 1000;
  let calls = 0;
  const load = async () => {
    calls++;
    return data;
  };
  const options = { path, now: () => timestamp };
  try {
    assert.deepEqual(await loadCachedAndroidVersions(load, options), data);
    assert.equal(calls, 1);
    timestamp += ANDROID_VERSION_CACHE_TTL - 1;
    assert.deepEqual(await loadCachedAndroidVersions(load, options), data);
    assert.equal(calls, 1);
    timestamp++;
    await loadCachedAndroidVersions(load, options);
    assert.equal(calls, 2);
    for (const contents of [
      JSON.stringify({
        version: ANDROID_VERSION_CACHE_VERSION - 1,
        createdAt: timestamp,
        data,
      }),
      '{broken',
      JSON.stringify({
        version: ANDROID_VERSION_CACHE_VERSION,
        createdAt: timestamp,
        data: [{}],
      }),
      JSON.stringify({
        version: ANDROID_VERSION_CACHE_VERSION,
        createdAt: timestamp + 1,
        data,
      }),
    ]) {
      await writeFile(path, contents);
      const before = calls;
      await loadCachedAndroidVersions(load, options);
      assert.equal(calls, before + 1);
    }
    const valid = await readFile(path, 'utf8');
    timestamp += ANDROID_VERSION_CACHE_TTL;
    await assert.rejects(
      loadCachedAndroidVersions(async () => {
        throw new Error('offline');
      }, options),
      /offline/,
    );
    assert.equal(await readFile(path, 'utf8'), valid);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
