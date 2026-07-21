import assert from 'node:assert/strict';
import { loadAndroidVersionList } from '../src/data.ts';
import { queryAndroidApi } from '../src/query.ts';
import { searchFilePathByRefName } from '../src/resolve.ts';
import type { AndroidApiQueryRuntime } from '../src/types.ts';

const version13Tags = [
  'android-13.0.0_r16',
  'android-13.0.0_r1',
  'android-13.0.0_r2',
];
const version14Tags = ['android-14.0.0_r2', 'android-14.0.0_r1'];
const runtime: AndroidApiQueryRuntime = {
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

{
  const files = [
    'core/java/android/app/IExample.java',
    'core/java/android/app/Outer.java',
    'core/java/android/database/ContentObserver.java',
    'opengl/java/android/opengl/GLU.java',
  ];
  const resolve = (apiName: string) => searchFilePathByRefName(apiName, files);

  assert.equal(resolve('ContentObserver')?.targetKind, 'class');
  assert.deepEqual(resolve('ContentObserver')?.targetPaths, [
    'ContentObserver',
  ]);
  assert.deepEqual(resolve('ContentObserver()')?.targetPaths, [
    'ContentObserver',
    'ContentObserver',
  ]);
  assert.equal(resolve('ContentObserver()')?.targetKind, 'member');
  assert.deepEqual(resolve('android.database.ContentObserver()')?.targetPaths, [
    'ContentObserver',
    'ContentObserver',
  ]);
  assert.deepEqual(resolve('Outer.Inner()')?.targetPaths, [
    'Outer',
    'Inner',
    'Inner',
  ]);
  assert.deepEqual(resolve('Outer.URL()')?.targetPaths, ['Outer', 'URL']);
  assert.equal(resolve('Outer.URL()')?.targetKind, 'member');
  assert.deepEqual(resolve('Outer.URL#URL')?.targetPaths, [
    'Outer',
    'URL',
    'URL',
  ]);
  assert.deepEqual(resolve('IExample.ping()')?.targetPaths, [
    'IExample',
    'ping',
  ]);
  assert.deepEqual(resolve('IExample.PING()')?.targetPaths, [
    'IExample',
    'PING',
  ]);
  assert.deepEqual(resolve('GLU()')?.targetPaths, ['GLU', 'GLU']);
  assert.deepEqual(resolve('android.opengl.GLU()')?.targetPaths, [
    'GLU',
    'GLU',
  ]);
  assert.deepEqual(resolve('IExample#ping()')?.targetPaths, [
    'IExample',
    'ping',
  ]);
  assert.deepEqual(resolve('ContentObserver#ContentObserver')?.targetPaths, [
    'ContentObserver',
    'ContentObserver',
  ]);
}

{
  const constructorRuntime: AndroidApiQueryRuntime = {
    loadAidlJavaFiles: async () => [
      'core/java/android/database/ContentObserver.java',
    ],
    loadAndroidVersionList: async () => [
      {
        version: '15',
        alias: 'VANILLA_ICE_CREAM',
        apiVersion: 35,
        tags: ['android-15.0.0_r1'],
        futureTags: [],
      },
    ],
    fetchText: async () => `
package android.database;

public abstract class ContentObserver {
  public ContentObserver(Handler handler) {}
  public ContentObserver(Handler handler, int flags) {}
  public void ContentObserver() {}
  public int ContentObserver;
}
`,
  };
  const constructorResult = await queryAndroidApi(constructorRuntime, {
    apiName: 'ContentObserver()',
  });

  assert.deepEqual(constructorResult.resolvedTarget?.paths, [
    'ContentObserver',
    'ContentObserver',
  ]);
  assert.deepEqual(
    constructorResult.ranges[0]?.members?.map((member) => ({
      kind: member.kind,
      type: member.type,
    })),
    [
      { kind: 'constructor', type: '(Handler) -> ContentObserver' },
      { kind: 'constructor', type: '(Handler, int) -> ContentObserver' },
    ],
  );

  const legacyConstructorResult = await queryAndroidApi(constructorRuntime, {
    apiName: 'ContentObserver#ContentObserver',
  });
  assert.deepEqual(
    legacyConstructorResult.ranges[0]?.members?.map((member) => ({
      kind: member.kind,
      type: member.type,
    })),
    constructorResult.ranges[0]?.members?.map((member) => ({
      kind: member.kind,
      type: member.type,
    })),
  );
}

const progressUpdates: Array<{
  completedTags: number;
  totalTags: number;
}> = [];
const result = await queryAndroidApi(runtime, {
  apiName: 'IExample.ping',
  minSdk: 33,
  concurrency: 1,
  onProgress: ({ completedTags, totalTags }) => {
    progressUpdates.push({ completedTags, totalTags });
  },
});

assert.equal(result.summary.checkedTags, 5);
assert.deepEqual(
  progressUpdates.map(({ completedTags }) => completedTags),
  [0, 1, 2, 3, 4, 5],
);
assert.deepEqual(
  new Set(progressUpdates.map(({ totalTags }) => totalTags)),
  new Set([5]),
);
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
  const startedTags: string[] = [];
  const versionMajorRuntime: AndroidApiQueryRuntime = {
    loadAidlJavaFiles: async () => ['core/java/android/app/IOrdered.aidl'],
    loadAndroidVersionList: async () => [
      {
        version: '8',
        alias: 'O',
        apiVersion: 26,
        tags: ['android-8.0.0_r1', 'android-8.0.0_r2'],
        futureTags: [],
      },
      {
        version: '9',
        alias: 'P',
        apiVersion: 28,
        tags: ['android-9.0.0_r1', 'android-9.0.0_r2'],
        futureTags: [],
      },
      {
        version: '10',
        alias: 'Q',
        apiVersion: 29,
        tags: ['android-10.0.0_r1'],
        futureTags: [],
      },
    ],
    fetchText: async (url) => {
      const match = url.match(/\/(android-[^/]+)\//);
      assert.ok(match?.[1]);
      startedTags.push(match[1]);
      return `
package android.app;
interface IOrdered {
  void ping();
}
`;
    },
  };

  await queryAndroidApi(versionMajorRuntime, {
    apiName: 'IOrdered.ping',
    concurrency: 1,
  });
  assert.deepEqual(startedTags, [
    'android-8.0.0_r1',
    'android-8.0.0_r2',
    'android-9.0.0_r1',
    'android-9.0.0_r2',
    'android-10.0.0_r1',
  ]);
}

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
  const githubRuntime: AndroidApiQueryRuntime = {
    sourceProvider: 'googlesource',
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
        assert.match(url, /^https:\/\/raw\.githubusercontent\.com\//);
        return url.includes('android-13.0.0_r2/') ? '404: Not Found' : source;
      } finally {
        activeRequests--;
      }
    },
  };

  const githubResult = await queryAndroidApi(githubRuntime, {
    apiName: 'IExample.ping',
    minSdk: 33,
    concurrency: 1,
  });

  assert.equal(maxActiveRequests, 1);
  assert.equal(fetchedUrls.length, 3);
  assert.equal(githubResult.summary.checkedTags, 3);
  assert.equal(githubResult.summary.foundTags, 2);
  assert.equal(
    githubResult.ranges.find((range) => range.missingReason)?.missingReason,
    'source-file-not-found',
  );
}

{
  const fetchedUrls: string[] = [];
  const versionList = await loadAndroidVersionList({
    fetchText: async (url) => {
      fetchedUrls.push(url);
      if (url.includes('android.googlesource.com')) {
        return `)]}'\n${JSON.stringify({
          'android-13.0.0_r1': { peeled: '', value: '' },
          'android-13.0.0_r2': { peeled: '', value: '' },
        })}`;
      }
      return [
        'refs/tags/android-13.0.0_r1',
        'refs/tags/android-13.0.0_r1^{}',
        'refs/tags/android-13.0.0_r3',
        'refs/tags/not-an-android-release',
      ].join('\n');
    },
  });

  assert.deepEqual(fetchedUrls, [
    'https://android.googlesource.com/platform/frameworks/base/+refs/tags/?format=JSON',
    'https://github.com/aosp-mirror/platform_frameworks_base.git/info/refs?service=git-upload-pack',
  ]);
  assert.deepEqual(versionList, [
    {
      version: '13',
      alias: 'TIRAMISU',
      apiVersion: 33,
      tags: ['android-13.0.0_r1', 'android-13.0.0_r3'],
      futureTags: ['android-13.0.0_r2'],
    },
    {
      version: '16',
      alias: 'BAKLAVA',
      apiVersion: 36,
      tags: ['android-16.0.0_r4'],
      futureTags: [],
    },
    {
      version: '17',
      alias: 'CINNAMON_BUN',
      apiVersion: 37,
      tags: ['android-17.0.0_r1'],
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

  const firstResult = await queryAndroidApi(
    {
      ...runtimeOverrides,
      fetchText: async (url) => {
        fetchedUrls.push(url);
        return source;
      },
    },
    {
      apiName: 'IExample.ping',
      minSdk: 33,
      concurrency: 1,
    },
  );
  const cachedResult = await queryAndroidApi(
    {
      ...runtimeOverrides,
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
  assert.equal(firstResult.summary.foundTags, 1);
  assert.equal(cachedResult.summary.foundTags, 1);
  assert.equal(fetchedUrls.length, 1);
  assert.deepEqual([...cachedTexts.keys()], [cacheKey]);
  assert.equal(cachedTexts.get(cacheKey), source);
}

{
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    queryAndroidApi(runtime, {
      apiName: 'IExample.ping',
      minSdk: 33,
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof DOMException && error.name === 'AbortError',
  );
}

{
  const controller = new AbortController();
  let markFetchStarted!: () => void;
  const fetchStarted = new Promise<void>((resolve) => {
    markFetchStarted = resolve;
  });
  const query = queryAndroidApi(
    {
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
      fetchText: async (_url, signal) => {
        assert.equal(signal, controller.signal);
        markFetchStarted();
        return new Promise<string>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        });
      },
    },
    {
      apiName: 'IExample.ping',
      minSdk: 33,
      concurrency: 1,
      signal: controller.signal,
    },
  );
  await fetchStarted;
  controller.abort();
  await assert.rejects(
    query,
    (error: unknown) =>
      error instanceof DOMException && error.name === 'AbortError',
  );
}

console.log('query tests passed');
