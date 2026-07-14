import { strict as assert } from 'node:assert';
import { renderAndroidApiCode } from '../src/code-render.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiQueryResult,
  AndroidApiVersionRangeResult,
} from '../src/types.ts';

const field = (
  fieldNullability?: Extract<
    AndroidApiMemberResult,
    { kind: 'field' }
  >['fieldNullability'],
): AndroidApiMemberResult => ({
  kind: 'field',
  name: 'name',
  type: 'String',
  ...(fieldNullability ? { fieldNullability } : {}),
});

const method = (
  type: string,
  parameters: Extract<AndroidApiMemberResult, { kind: 'method' }>['parameters'],
  name = 'getTasks',
): AndroidApiMemberResult => ({
  kind: 'method',
  name,
  type: `(${parameters.map((parameter) => parameter.type).join(', ')}) -> ${type}`,
  returnType: type,
  parameters,
});

const range = (
  version: string,
  alias: string,
  apiVersion: number,
  tag: string,
  members: AndroidApiMemberResult[],
  missingReason?: AndroidApiVersionRangeResult['missingReason'],
): AndroidApiVersionRangeResult => ({
  fromVersion: version,
  fromAlias: alias,
  fromApiVersion: apiVersion,
  fromTag: tag,
  toVersion: version,
  toAlias: alias,
  toApiVersion: apiVersion,
  toTag: tag,
  ...(missingReason ? { missingReason } : {}),
  members,
});

const rangeSpan = (
  fromVersion: string,
  fromAlias: string,
  fromApiVersion: number,
  fromTag: string,
  toVersion: string,
  toAlias: string,
  toApiVersion: number,
  toTag: string,
  members: AndroidApiMemberResult[],
  missingReason?: AndroidApiVersionRangeResult['missingReason'],
): AndroidApiVersionRangeResult => ({
  fromVersion,
  fromAlias,
  fromApiVersion,
  fromTag,
  toVersion,
  toAlias,
  toApiVersion,
  toTag,
  ...(missingReason ? { missingReason } : {}),
  members,
});

const baseResult = (
  apiName: string,
  sourcePath: string,
  targetPaths: string[],
  ranges: AndroidApiVersionRangeResult[],
): AndroidApiQueryResult => ({
  apiName,
  normalizedApiName: apiName,
  source: {
    repo: 'platform/frameworks/base',
    path: sourcePath,
  },
  resolvedTarget: {
    kind: 'member',
    paths: targetPaths,
  },
  summary: {
    checkedTags: ranges.length,
    foundTags: ranges.length,
    rangeCount: ranges.length,
    signatures: [],
  },
  ranges,
});

{
  const result = renderAndroidApiCode(
    baseResult(
      'UserInfo.name',
      'core/java/android/content/pm/UserInfo.java',
      ['UserInfo', 'name'],
      [
        range('8', 'O', 26, 'android-8.0.0_r1', [field()]),
        range('13', 'TIRAMISU', 33, 'android-13.0.0_r1', [field('nullable')]),
      ],
    ),
  );

  assert.equal(result.declarations.length, 1);
  assert.match(result.code, /^package android\.content\.pm;/);
  assert.doesNotMatch(result.code, /@RequiresApi\(Build\.VERSION_CODES\.O\)/);
  assert.doesNotMatch(result.code, /@DeprecatedSinceApi/);
  assert.match(result.code, /public @Nullable String name;/);
  assert.doesNotMatch(result.code, /li\.songe\.remap\.RemapType/);
}

{
  const result = renderAndroidApiCode(
    baseResult(
      'UserInfoHidden.name',
      'core/java/android/content/pm/UserInfo.java',
      ['UserInfo', 'name'],
      [range('8', 'O', 26, 'android-8.0.0_r1', [field()])],
    ),
  );

  assert.equal(result.declarations.length, 1);
  assert.match(result.code, /^package android\.content\.pm;/);
  assert.match(result.code, /import li\.songe\.remap\.RemapType;/);
  assert.match(
    result.code,
    /@RemapType\(UserInfo\.class\)\npublic class UserInfoHidden \{/,
  );
  assert.doesNotMatch(result.code, /public class UserInfo \{/);
}

{
  const result = renderAndroidApiCode(
    baseResult(
      'UserInfo.name',
      'core/java/android/content/pm/UserInfo.java',
      ['UserInfo', 'name'],
      [
        range('8', 'O', 26, 'android-8.0.0_r1', [], 'api-not-found'),
        range('10', 'Q', 29, 'android-10.0.0_r1', [field()]),
      ],
    ),
  );

  assert.equal(result.declarations.length, 1);
  assert.match(result.code, /@RequiresApi\(Build\.VERSION_CODES\.Q\)/);
  assert.match(result.code, /public String name;/);
}

{
  const methodA = method(
    'ParceledListSlice<PackageInfo>',
    [
      { name: 'flags', type: 'long' },
      { name: 'userId', type: 'int' },
    ],
    'getInstalledPackages',
  );
  const methodB = method(
    'PackageInfoList',
    [
      { name: 'flags', type: 'long' },
      { name: 'userId', type: 'int' },
    ],
    'getInstalledPackages',
  );
  const result = renderAndroidApiCode(
    baseResult(
      'IPackageManager.getInstalledPackages',
      'core/java/android/content/pm/IPackageManager.aidl',
      ['IPackageManager', 'getInstalledPackages'],
      [
        rangeSpan(
          '8',
          'O',
          26,
          'android-8.0.0_r1',
          '12.1',
          'S_V2',
          32,
          'android-12.1.0_r1',
          [],
          'api-not-found',
        ),
        rangeSpan(
          '13',
          'TIRAMISU',
          33,
          'android-13.0.0_r1',
          '16',
          'BAKLAVA',
          36,
          'android-16.0.0_r1',
          [methodA],
        ),
        range('17', 'CINNAMON_BUN', 37, 'android-17.0.0_r1', [methodB]),
      ],
    ),
  );

  assert.equal(result.declarations.length, 2);
  assert.equal(result.declarations[0]?.remapMethodName, 'getInstalledPackages');
  assert.equal(result.declarations[0]?.member.name, 'getInstalledPackagesV13');
  assert.equal(result.declarations[1]?.remapMethodName, undefined);
  assert.equal(result.declarations[1]?.member.name, 'getInstalledPackages');
  assert.match(
    result.code,
    /package android\.content\.pm;\n\nimport android\.os\.Binder;\nimport android\.os\.Build;\nimport android\.os\.IBinder;\nimport android\.os\.IInterface;\n\nimport androidx\.annotation\.DeprecatedSinceApi;\nimport androidx\.annotation\.RequiresApi;\n\nimport li\.songe\.remap\.RemapMethod;/,
  );
  assert.match(result.code, /import li\.songe\.remap\.RemapMethod;/);
  assert.doesNotMatch(result.code, /import android\.content\.pm\.PackageInfo;/);
  assert.doesNotMatch(
    result.code,
    /import android\.content\.pm\.ParceledListSlice;/,
  );
  assert.match(
    result.code,
    /@DeprecatedSinceApi\(api = Build\.VERSION_CODES\.CINNAMON_BUN\)\n\s+@RemapMethod\("getInstalledPackages"\)\n\s+ParceledListSlice<PackageInfo> getInstalledPackagesV13\(long flags, int userId\);/,
  );
  assert.match(
    result.code,
    /@RequiresApi\(Build\.VERSION_CODES\.CINNAMON_BUN\)\n\s+PackageInfoList getInstalledPackages\(long flags, int userId\);/,
  );
  assert.equal(
    (result.code.match(/getInstalledPackages\(long flags, int userId\)/g) ?? [])
      .length,
    1,
  );
}

{
  const methodA = method(
    'ParceledListSlice<PackageInfo>',
    [{ name: 'flags', type: 'int' }],
    'getInstalledPackages',
  );
  const methodB = method(
    'PackageInfoList',
    [
      { name: 'flags', type: 'long' },
      { name: 'userId', type: 'int' },
    ],
    'getInstalledPackages',
  );
  const result = renderAndroidApiCode(
    baseResult(
      'IPackageManager.getInstalledPackages',
      'core/java/android/content/pm/IPackageManager.aidl',
      ['IPackageManager', 'getInstalledPackages'],
      [
        range('16', 'BAKLAVA', 36, 'android-16.0.0_r1', [methodA]),
        range('17', 'CINNAMON_BUN', 37, 'android-17.0.0_r1', [methodB]),
      ],
    ),
  );

  assert.equal(result.declarations.length, 2);
  assert.doesNotMatch(result.code, /@RemapMethod/);
  assert.doesNotMatch(result.code, /li\.songe\.remap\.RemapMethod/);
  assert.match(
    result.code,
    /ParceledListSlice<PackageInfo> getInstalledPackages\(int flags\);/,
  );
  assert.match(
    result.code,
    /PackageInfoList getInstalledPackages\(long flags, int userId\);/,
  );
}

{
  const methodA = method(
    'List<UserInfo>',
    [{ name: 'excludeDying', type: 'boolean' }],
    'getUsers',
  );
  const methodB = method(
    'List<UserInfo>',
    [
      { name: 'excludePartial', type: 'boolean' },
      { name: 'excludeDying', type: 'boolean' },
      { name: 'excludePreCreated', type: 'boolean' },
    ],
    'getUsers',
  );
  const result = renderAndroidApiCode(
    baseResult(
      'IUserManager.getUsers',
      'core/java/android/os/IUserManager.aidl',
      ['IUserManager', 'getUsers'],
      [
        range('8', 'O', 26, 'android-8.0.0_r1', [methodA]),
        range('8', 'O', 26, 'android-8.0.0_r2', [methodA]),
        range('8', 'O', 26, 'android-8.0.0_r3', [methodA]),
        range('8', 'O', 26, 'android-8.0.0_r4', [methodA]),
        rangeSpan(
          '8',
          'O',
          26,
          'android-8.0.0_r7',
          '10',
          'Q',
          29,
          'android-10.0.0_r29',
          [methodA],
        ),
        rangeSpan(
          '10',
          'Q',
          29,
          'android-10.0.0_r30',
          '10',
          'Q',
          29,
          'android-10.0.0_r45',
          [],
          'api-not-found',
        ),
        rangeSpan(
          '10',
          'Q',
          29,
          'android-10.0.0_r46',
          '10',
          'Q',
          29,
          'android-10.0.0_r52',
          [methodA],
        ),
        rangeSpan(
          '11',
          'R',
          30,
          'android-11.0.0_r1',
          '16',
          'BAKLAVA',
          36,
          'android-16.0.0_r2',
          [methodB],
        ),
        rangeSpan(
          '16',
          'BAKLAVA',
          36,
          'android-16.0.0_r3',
          '17',
          'CINNAMON_BUN',
          37,
          'android-17.0.0_r1',
          [methodA],
        ),
      ],
    ),
  );

  assert.equal(result.declarations.length, 2);
  assert.doesNotMatch(result.code, /@RequiresApi/);
  assert.doesNotMatch(result.code, /@DeprecatedSinceApi/);
  assert.doesNotMatch(result.code, /androidx\.annotation\.RequiresApi/);
  assert.doesNotMatch(result.code, /androidx\.annotation\.DeprecatedSinceApi/);
  assert.match(result.code, /import android\.content\.pm\.UserInfo;/);
  assert.match(
    result.code,
    /\/\/ 8 - 10\.0\.0_r29, 10\.0\.0_r46 - 10, 16\.0\.0_r3 - 17\n\s+List<UserInfo> getUsers\(boolean excludeDying\);/,
  );
  assert.doesNotMatch(
    result.code,
    /8\.0\.0_r1, 8\.0\.0_r2, 8\.0\.0_r3, 8\.0\.0_r4/,
  );
  assert.match(
    result.code,
    /\/\/ 11 - 16\.0\.0_r2\n\s+List<UserInfo> getUsers\(boolean excludePartial, boolean excludeDying, boolean excludePreCreated\);/,
  );
  assert.equal(
    (result.code.match(/getUsers\(boolean excludeDying\)/g) ?? []).length,
    1,
  );
}

{
  const methodA = method('List<ActivityManager.RunningTaskInfo>', [
    { name: 'maxNum', type: 'int' },
  ]);
  const methodB = method('List<ActivityManager.RunningTaskInfo>', [
    { name: 'maxNum', type: 'int' },
    { name: 'filterOnlyVisibleRecents', type: 'boolean' },
    { name: 'keepIntentExtra', type: 'boolean' },
  ]);
  const methodC = method('List<ActivityManager.RunningTaskInfo>', [
    { name: 'maxNum', type: 'int' },
    { name: 'filterOnlyVisibleRecents', type: 'boolean' },
    { name: 'keepIntentExtra', type: 'boolean' },
    { name: 'displayId', type: 'int' },
  ]);
  const result = renderAndroidApiCode(
    baseResult(
      'IActivityTaskManager.getTasks',
      'core/java/android/app/IActivityTaskManager.aidl',
      ['IActivityTaskManager', 'getTasks'],
      [
        range('10', 'Q', 29, 'android-10.0.0_r1', [methodA]),
        range('12', 'S', 31, 'android-12.0.0_r1', [methodB]),
        range('13', 'TIRAMISU', 33, 'android-13.0.0_r1', [methodC]),
        range('13', 'TIRAMISU', 33, 'android-13.0.0_r2', [methodC]),
        range('13', 'TIRAMISU', 33, 'android-13.0.0_r3', [methodB]),
      ],
    ),
  );

  assert.equal(result.declarations.length, 3);
  assert.match(result.code, /^package android\.app;/);
  assert.match(result.code, /import android\.os\.Binder;/);
  assert.match(result.code, /import android\.os\.IBinder;/);
  assert.match(result.code, /import android\.os\.IInterface;/);
  assert.match(result.code, /import java\.util\.List;/);
  assert.match(result.code, /import androidx\.annotation\.RequiresApi;/);
  assert.match(result.code, /import androidx\.annotation\.DeprecatedSinceApi;/);
  assert.match(
    result.code,
    /package android\.app;\n\nimport android\.os\.Binder;\nimport android\.os\.Build;\nimport android\.os\.IBinder;\nimport android\.os\.IInterface;\n\nimport androidx\.annotation\.DeprecatedSinceApi;\nimport androidx\.annotation\.RequiresApi;\n\nimport java\.util\.List;/,
  );
  assert.equal(
    result.declarations.filter(
      (declaration) => declaration.requiresApi.alias === 'TIRAMISU',
    ).length,
    1,
  );
}

console.log('code-render tests passed');
