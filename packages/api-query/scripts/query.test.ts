import assert from 'node:assert/strict';
import { loadAndroidVersionList } from '../src/data.ts';
import { queryAndroidApi } from '../src/query.ts';
import type { AndroidApiQueryRuntime } from '../src/types.ts';

const version13Tags = [
  'android-13.0.0_r16',
  'android-13.0.0_r1',
  'android-13.0.0_r2',
];
const version14Tags = ['android-14.0.0_r2', 'android-14.0.0_r1'];
const runtime: AndroidApiQueryRuntime = {
  sourceProvider: 'github',
  loadAidlJavaFiles: async () => ['core/java/android/app/IExample.java'],
  loadAndroidVersionList: async () => [
    {
      version: '14',
      alias: 'UPSIDE_DOWN_CAKE',
      apiVersion: 34,
      tags: version14Tags,
      futureTags: [],
    },
    {
      version: '13',
      alias: 'TIRAMISU',
      apiVersion: 33,
      tags: version13Tags,
      futureTags: [],
    },
  ],
  fetchText: async (url) => {
    const returnType = url.includes('android-13.0.0_r1/') ? 'void' : 'int';
    return `
package android.app;

public interface IExample {
  ${returnType} ping();
}
`;
  },
};

const result = await queryAndroidApi(runtime, {
  apiName: 'IExample.ping',
  minSdk: 33,
  concurrency: 1,
});

assert.equal(result.summary.checkedTags, 5);
assert.equal(result.ranges.length, 2);
assert.deepEqual(
  result.ranges.map((range) => ({
    fromVersion: range.fromVersion,
    fromTag: range.fromTag,
    fromTagPosition: range.fromTagPosition,
    toVersion: range.toVersion,
    toTag: range.toTag,
    toTagPosition: range.toTagPosition,
  })),
  [
    {
      fromVersion: '13',
      fromTag: 'android-13.0.0_r1',
      fromTagPosition: 'first-checked',
      toVersion: '13',
      toTag: 'android-13.0.0_r1',
      toTagPosition: undefined,
    },
    {
      fromVersion: '13',
      fromTag: 'android-13.0.0_r2',
      fromTagPosition: undefined,
      toVersion: '14',
      toTag: 'android-14.0.0_r2',
      toTagPosition: 'last-checked',
    },
  ],
);

{
  const fetchedUrls: string[] = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const source = `
package android.app;

public interface IExample {
  int ping();
}
`;
  const conflictingGoogleSource = source.replace('int ping()', 'void ping()');
  const dualSourceRuntime: AndroidApiQueryRuntime = {
    sourceProvider: 'github-googlesource',
    loadAidlJavaFiles: async () => ['core/java/android/app/IExample.java'],
    loadAndroidVersionList: async () => [
      {
        version: '13',
        alias: 'TIRAMISU',
        apiVersion: 33,
        tags: ['android-13.0.0_r1', 'android-13.0.0_r2', 'android-13.0.0_r3'],
        futureTags: [],
      },
    ],
    fetchText: async (url) => {
      fetchedUrls.push(url);
      activeRequests++;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await Promise.resolve();
      try {
        if (url.includes('raw.githubusercontent.com')) {
          return url.includes('android-13.0.0_r2/') ? '404: Not Found' : source;
        }
        if (url.includes('android.googlesource.com')) {
          if (url.includes('android-13.0.0_r1/')) {
            return 'RESOURCE_EXHAUSTED: Resource has been exhausted';
          }
          return btoa(
            url.includes('android-13.0.0_r3/')
              ? conflictingGoogleSource
              : source,
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      } finally {
        activeRequests--;
      }
    },
  };

  const dualSourceResult = await queryAndroidApi(dualSourceRuntime, {
    apiName: 'IExample.ping',
    minSdk: 33,
    concurrency: 1,
  });

  assert.equal(maxActiveRequests, 2);
  assert.equal(
    fetchedUrls.filter((url) => url.includes('raw.githubusercontent.com'))
      .length,
    3,
  );
  assert.equal(
    fetchedUrls.filter((url) => url.includes('android.googlesource.com'))
      .length,
    3,
  );
  assert.equal(dualSourceResult.summary.checkedTags, 3);
  assert.equal(dualSourceResult.summary.foundTags, 3);
  assert.equal(dualSourceResult.ranges.length, 1);
  assert.equal(dualSourceResult.ranges[0]?.members?.[0]?.type, '() -> int');
}

{
  const fetchedUrls: string[] = [];
  const versionList = await loadAndroidVersionList({
    sourceProvider: 'github-googlesource',
    fetchText: async (url) => {
      fetchedUrls.push(url);
      return `)]}'\n${JSON.stringify({
        'android-13.0.0_r1': { peeled: '', value: '' },
      })}`;
    },
  });

  assert.deepEqual(fetchedUrls, [
    'https://android.googlesource.com/platform/frameworks/base/+refs/tags/?format=JSON',
  ]);
  assert.deepEqual(versionList, [
    {
      version: '13',
      alias: 'TIRAMISU',
      apiVersion: 33,
      tags: ['android-13.0.0_r1'],
      futureTags: [],
    },
  ]);
}

{
  const fetchedUrls: string[] = [];
  const source = `
package android.app;

public interface IExample {
  int ping();
}
`;
  const cachedTexts = new Map<string, string>();
  const textCache = {
    get: async (key: string) => cachedTexts.get(key),
    set: async (key: string, value: string) => {
      cachedTexts.set(key, value);
    },
  };
  const runtimeOverrides = {
    loadAidlJavaFiles: async () => ['core/java/android/app/IExample.java'],
    loadAndroidVersionList: async () => [
      {
        version: '13',
        alias: 'TIRAMISU',
        apiVersion: 33,
        tags: ['android-13.0.0_r1'],
        futureTags: [],
      },
    ],
    textCache,
  } satisfies Partial<AndroidApiQueryRuntime>;

  const googleResult = await queryAndroidApi(
    {
      ...runtimeOverrides,
      sourceProvider: 'googlesource',
      fetchText: async (url) => {
        fetchedUrls.push(url);
        return btoa(source);
      },
    },
    {
      apiName: 'IExample.ping',
      minSdk: 33,
      concurrency: 1,
    },
  );
  const githubResult = await queryAndroidApi(
    {
      ...runtimeOverrides,
      sourceProvider: 'github',
      fetchText: async (url) => {
        throw new Error(`Unexpected cache miss: ${url}`);
      },
    },
    {
      apiName: 'IExample.ping',
      minSdk: 33,
      concurrency: 1,
    },
  );

  const cacheKey = 'android-13.0.0_r1/core/java/android/app/IExample.java';
  assert.equal(googleResult.summary.foundTags, 1);
  assert.equal(githubResult.summary.foundTags, 1);
  assert.equal(fetchedUrls.length, 1);
  assert.deepEqual([...cachedTexts.keys()], [cacheKey]);
  assert.equal(cachedTexts.get(cacheKey), source);
}

console.log('query tests passed');
