import assert from 'node:assert/strict';
import { renderAndroidApiCode } from '../src/code-render.ts';
import { loadAndroidVersionList } from '../src/data.ts';
import {
  normalizeAndroidApiMemberRanges,
  queryAndroidApi,
  STRUCT_CACHE_VERSION,
} from '../src/query.ts';
import { searchFilePathByRefName } from '../src/resolve.ts';
import { toAndroidApiResolvedType } from '../src/struct.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiQueryRuntime,
  AndroidApiStructCacheEntry,
} from '../src/types.ts';

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
  const oldMember: AndroidApiMemberResult = {
    kind: 'method',
    name: 'ping',
    type: '() -> void',
    imports: [],
    returnType: 'void',
    parameters: [],
  };
  const latestMember: AndroidApiMemberResult = {
    ...oldMember,
    type: '() -> int',
    returnType: 'int',
  };
  const normalized = normalizeAndroidApiMemberRanges([
    {
      fromVersion: '14',
      fromAlias: 'UPSIDE_DOWN_CAKE',
      fromApiVersion: 34,
      fromTag: 'android-14.0.0_r1',
      toVersion: '14',
      toAlias: 'UPSIDE_DOWN_CAKE',
      toApiVersion: 34,
      toTag: 'android-14.0.0_r1',
      members: [latestMember],
    },
    {
      fromVersion: '13',
      fromAlias: 'TIRAMISU',
      fromApiVersion: 33,
      fromTag: 'android-13.0.0_r1',
      toVersion: '13',
      toAlias: 'TIRAMISU',
      toApiVersion: 33,
      toTag: 'android-13.0.0_r1',
      members: [oldMember],
    },
  ]);
  assert.equal(normalized.overloads[0]?.signature, '() -> int');
  assert.deepEqual(
    normalized.overloads[0]?.ranges.map((range) => range.fromTag),
    ['android-13.0.0_r1', 'android-14.0.0_r1'],
  );
}

{
  assert.deepEqual(
    toAndroidApiResolvedType({
      name: 'VisibleType',
      loc: 1,
      isAbstract: true,
      members: [],
      children: [
        {
          name: 'NestedType',
          loc: 2,
          members: [],
        },
      ],
    }),
    {
      name: 'VisibleType',
      kind: 'class',
      isAbstract: true,
      isHidden: false,
    },
  );
  assert.deepEqual(
    toAndroidApiResolvedType({
      name: 'HiddenInterface',
      loc: 3,
      isInterface: true,
      isHidden: true,
      members: [],
    }),
    {
      name: 'HiddenInterface',
      kind: 'interface',
      isHidden: true,
    },
  );
}

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
        tags: ['android-15.0.0_r1', 'android-15.0.0_r2'],
        futureTags: [],
      },
    ],
    fetchText: async (url) => `
package android.database;

public abstract class ContentObserver {
  public ContentObserver(Handler handler) {}
  ${
    url.includes('android-15.0.0_r2/')
      ? 'public ContentObserver(Handler handler, int flags) {}'
      : ''
  }
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
    constructorResult.overloads.map((overload) => ({
      overloadId: overload.overloadId,
      kind: overload.member.kind,
      type: overload.member.type,
    })),
    [
      {
        overloadId: 'constructor:ContentObserver(Handler)',
        kind: 'constructor',
        type: '(Handler) -> ContentObserver',
      },
      {
        overloadId: 'constructor:ContentObserver(Handler,int)',
        kind: 'constructor',
        type: '(Handler, int) -> ContentObserver',
      },
    ],
  );
  assert.equal(constructorResult.summary.overloadCount, 2);
  assert.equal(
    Object.hasOwn(constructorResult.ranges[0] ?? {}, 'members'),
    false,
  );
  assert.deepEqual(
    constructorResult.ranges.map((range) => range.overloadIds),
    [
      ['constructor:ContentObserver(Handler)'],
      [
        'constructor:ContentObserver(Handler)',
        'constructor:ContentObserver(Handler,int)',
      ],
    ],
  );
  assert.deepEqual(
    constructorResult.overloads[1]?.ranges.map((range) => range.missingReason),
    ['overload-not-found', undefined],
  );

  const legacyConstructorResult = await queryAndroidApi(constructorRuntime, {
    apiName: 'ContentObserver#ContentObserver',
  });
  assert.deepEqual(
    legacyConstructorResult.overloads.map((overload) => overload.overloadId),
    constructorResult.overloads.map((overload) => overload.overloadId),
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
assert.equal(result.summary.overloadCount, 1);
assert.equal(Object.hasOwn(result.summary, 'signatures'), false);
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
assert.deepEqual(result.ranges[0]?.overloadIds, ['method:ping()']);
assert.deepEqual(
  result.overloads.map((overload) => ({
    overloadId: overload.overloadId,
    signature: overload.signature,
    rangeCount: overload.ranges.length,
  })),
  [
    {
      overloadId: 'method:ping()',
      signature: '() -> int',
      rangeCount: 2,
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

  const versionMajorResult = await queryAndroidApi(versionMajorRuntime, {
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
  assert.equal(
    Object.hasOwn(versionMajorResult.overloads[0]?.member ?? {}, 'isHidden'),
    false,
  );
  assert.equal(versionMajorResult.resolvedTarget.typePath?.[0]?.isHidden, true);
  assert.doesNotMatch(
    renderAndroidApiCode(versionMajorResult).code,
    /RemapType/,
  );
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
  const source = `
package android.app;

public interface IExample {
  int ping();
}
`;
  const structs = new Map<string, AndroidApiStructCacheEntry>();
  const contentReuseRuntime: AndroidApiQueryRuntime = {
    loadAidlJavaFiles: async () => ['core/java/android/app/IExample.java'],
    loadAndroidVersionList: async () => [
      {
        version: '13',
        alias: 'TIRAMISU',
        apiVersion: 33,
        tags: ['android-13.0.0_r2', 'android-13.0.0_r1'],
        futureTags: [],
      },
    ],
    fetchText: async () => source,
    structCache: {
      get: async (key) => structs.get(key),
      set: async (key, value) => {
        structs.set(key, value);
      },
    },
  };

  const result = await queryAndroidApi(contentReuseRuntime, {
    apiName: 'IExample.ping',
    minSdk: 33,
    concurrency: 2,
  });
  const taggedValues = Array.from(structs)
    .filter(([key]) => key.startsWith(`${STRUCT_CACHE_VERSION}:android-`))
    .map(([, value]) => value);
  const contentValue = Array.from(structs).find(([key]) =>
    key.startsWith(`${STRUCT_CACHE_VERSION}:content:java:`),
  )?.[1];

  assert.equal(result.summary.checkedTags, 2);
  assert.equal(taggedValues.length, 2);
  assert.ok(contentValue);
  assert.strictEqual(taggedValues[0], taggedValues[1]);
  assert.strictEqual(taggedValues[0], contentValue);
}

{
  const importResult = await queryAndroidApi(
    {
      loadAidlJavaFiles: async () => [
        'core/java/android/example/IImportExample.java',
      ],
      loadAndroidVersionList: async () => [
        {
          version: '14',
          alias: 'UPSIDE_DOWN_CAKE',
          apiVersion: 34,
          tags: ['android-14.0.0_r1'],
          futureTags: [],
        },
      ],
      fetchText: async () => `
package android.example;

import java.util.List;
import sample.model.A;
import sample.model.Unused;

public interface IImportExample {
  List<A> load(A value);
}
`,
    },
    {
      apiName: 'IImportExample.load',
      minSdk: 34,
      concurrency: 1,
    },
  );
  assert.equal(importResult.package, 'android.example');
  assert.deepEqual(importResult.imports, ['java.util.List', 'sample.model.A']);
  assert.deepEqual(importResult.overloads[0]?.member.imports, [0, 1]);
  const code = renderAndroidApiCode(importResult).code;
  assert.match(code, /^package android\.example;/);
  assert.match(code, /import java\.util\.List;/);
  assert.match(code, /import sample\.model\.A;/);
  assert.doesNotMatch(code, /sample\.model\.Unused/);
  assert.match(code, /List<A> load\(A value\);/);
}

{
  const hiddenFieldResult = await queryAndroidApi(
    {
      loadAidlJavaFiles: async () => [
        'core/java/android/companion/virtual/VirtualDeviceManager.java',
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
package android.companion.virtual;

public final class VirtualDeviceManager {
  /**
   * Persistent device identifier corresponding to the default device.
   *
   * @hide
   */
  @Deprecated
  public static final String PERSISTENT_DEVICE_ID_DEFAULT = "default:0";
}
`,
    },
    {
      apiName: 'VirtualDeviceManager.PERSISTENT_DEVICE_ID_DEFAULT',
      minSdk: 35,
      concurrency: 1,
    },
  );
  assert.equal(
    Object.hasOwn(hiddenFieldResult.overloads[0]?.member ?? {}, 'isHidden'),
    false,
  );
  assert.equal(hiddenFieldResult.resolvedTarget.typePath?.[0]?.isHidden, false);
  assert.match(
    renderAndroidApiCode(hiddenFieldResult).code,
    /@RemapType\(VirtualDeviceManager\.class\)\npublic class VirtualDeviceManagerHidden \{/,
  );
}

{
  const hiddenTypeResult = await queryAndroidApi(
    {
      loadAidlJavaFiles: async () => [
        'core/java/android/os/ServiceManager.java',
      ],
      loadAndroidVersionList: async () => [
        {
          version: '14',
          alias: 'UPSIDE_DOWN_CAKE',
          apiVersion: 34,
          tags: ['android-14.0.0_r1'],
          futureTags: [],
        },
      ],
      fetchText: async () => `
package android.os;

/**
 * Manages binder services.
 *
 * @hide
 */
@Deprecated
public final class ServiceManager {
  /** @hide */
  public static IBinder getServiceOrThrow(String name) {
    return null;
  }
}
`,
    },
    {
      apiName: 'ServiceManager.getServiceOrThrow',
      minSdk: 34,
      concurrency: 1,
    },
  );
  assert.equal(hiddenTypeResult.resolvedTarget.typePath?.[0]?.isHidden, true);
  const code = renderAndroidApiCode(hiddenTypeResult).code;
  assert.doesNotMatch(code, /RemapType/);
  assert.match(code, /public class ServiceManager \{/);
  assert.doesNotMatch(code, /ServiceManagerHidden/);
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
