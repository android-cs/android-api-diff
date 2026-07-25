import { strict as assert } from 'node:assert';
import { renderAndroidApiCode } from '../src/code-render.ts';
import type {
  AndroidApiMemberResult,
  AndroidApiQueryResult,
  AndroidApiResolvedType,
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
  imports: [],
  ...(fieldNullability ? { fieldNullability } : {}),
});

const constant = (type = 'int', name = 'FLAG'): AndroidApiMemberResult => ({
  kind: 'constant',
  name,
  type,
  imports: [],
});

const method = (
  type: string,
  parameters: Extract<AndroidApiMemberResult, { kind: 'method' }>['parameters'],
  name = 'getTasks',
  isAbstract = false,
): AndroidApiMemberResult => ({
  kind: 'method',
  name,
  type: `(${parameters.map((parameter) => parameter.type).join(', ')}) -> ${type}`,
  imports: [],
  ...(isAbstract ? { isAbstract: true } : {}),
  returnType: type,
  parameters,
});

const constructor = (
  name: string,
  parameters: Extract<
    AndroidApiMemberResult,
    { kind: 'constructor' }
  >['parameters'],
): AndroidApiMemberResult => ({
  kind: 'constructor',
  name,
  type: `(${parameters.map((parameter) => parameter.type).join(', ')}) -> ${name}`,
  imports: [],
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
  typePath?: AndroidApiResolvedType[],
  imports: string[] = [],
): AndroidApiQueryResult => ({
  apiName,
  normalizedApiName: apiName,
  package: '',
  imports,
  source: {
    repo: 'platform/frameworks/base',
    path: sourcePath,
  },
  resolvedTarget: {
    kind: 'member',
    paths: targetPaths,
    ...(typePath ? { typePath } : {}),
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
      'android.database.ContentObserver()',
      'core/java/android/database/ContentObserver.java',
      ['ContentObserver', 'ContentObserver'],
      [
        range('15', 'VANILLA_ICE_CREAM', 35, 'android-15.0.0_r1', [
          constructor('ContentObserver', [
            { name: 'handler', type: 'Handler' },
          ]),
        ]),
      ],
    ),
  );

  assert.match(result.code, /^package android\.database;/);
  assert.match(result.code, /public class ContentObserver \{/);
  assert.match(
    result.code,
    /public ContentObserver\(Handler handler\) \{ throw new RuntimeException\(\); \}/,
  );
  assert.doesNotMatch(result.code, /class database/);
}

{
  const abstractMethod = method('String', [], 'getValue', true);
  const concreteMethod = method(
    'String',
    [{ name: 'flags', type: 'int' }],
    'getValue',
  );
  const result = renderAndroidApiCode(
    baseResult(
      'AbstractService.getValue',
      'core/java/android/app/AbstractService.java',
      ['AbstractService', 'getValue'],
      [
        range('8', 'O', 26, 'android-8.0.0_r1', [
          abstractMethod,
          concreteMethod,
        ]),
      ],
      [{ name: 'AbstractService', kind: 'class', isAbstract: true }],
    ),
  );

  assert.match(result.code, /public abstract class AbstractService \{/);
  assert.match(result.code, /public abstract String getValue\(\);/);
  assert.doesNotMatch(
    result.code,
    /getValue\(\) \{ throw new RuntimeException\(\); \}/,
  );
  assert.match(
    result.code,
    /public String getValue\(int flags\) \{ throw new RuntimeException\(\); \}/,
  );
}

{
  const result = renderAndroidApiCode(
    baseResult(
      'TaskManager.clear',
      'core/java/android/app/TaskManager.java',
      ['TaskManager', 'clear'],
      [range('8', 'O', 26, 'android-8.0.0_r1', [method('void', [], 'clear')])],
      [{ name: 'TaskManager', kind: 'class' }],
    ),
  );

  assert.match(result.code, /public void clear\(\) \{\}/);
  assert.doesNotMatch(result.code, /clear\(\).*RuntimeException/);
}

{
  const transact: AndroidApiMemberResult = {
    kind: 'method',
    name: 'transact',
    type: '(int, HwParcel, HwParcel, int) -> void',
    imports: [],
    returnType: 'void',
    returnNullability: 'non-null',
    parameters: [
      { name: 'code', type: 'int', nullability: 'non-null' },
      { name: 'request', type: 'HwParcel' },
      { name: 'reply', type: 'HwParcel' },
      { name: 'flags', type: 'int', nullability: 'non-null' },
    ],
  };
  const result = renderAndroidApiCode(
    baseResult(
      'IHwBinder.transact',
      'core/java/android/os/IHwBinder.java',
      ['IHwBinder', 'transact'],
      [range('8', 'O', 26, 'android-8.0.0_r1', [transact])],
      [{ name: 'IHwBinder', kind: 'interface' }],
    ),
  );

  assert.match(result.code, /public interface IHwBinder \{/);
  assert.match(
    result.code,
    /void transact\(int code, HwParcel request, HwParcel reply, int flags\);/,
  );
  assert.doesNotMatch(result.code, /android\.annotation\.NonNull/);
  assert.doesNotMatch(result.code, /@NonNull/);
  assert.doesNotMatch(result.code, /transact\(.*RuntimeException/);
}

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
  assert.match(result.code, /import android\.annotation\.Nullable;/);
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
    'String',
    [{ name: 'callingPkg', type: 'String' }],
    'call',
  );
  const methodB = method(
    'String',
    [
      { name: 'callingPkg', type: 'String' },
      { name: 'authority', type: 'String' },
    ],
    'call',
  );
  const methodC = method(
    'String',
    [
      { name: 'callingPkg', type: 'String' },
      { name: 'attributionTag', type: 'String' },
      { name: 'authority', type: 'String' },
    ],
    'call',
  );
  const methodD = method(
    'String',
    [
      { name: 'attributionSource', type: 'String' },
      { name: 'authority', type: 'String' },
      { name: 'method', type: 'String' },
      { name: 'arg', type: 'String' },
    ],
    'call',
  );
  const result = renderAndroidApiCode(
    baseResult(
      'IContentProvider.call',
      'core/java/android/content/IContentProvider.java',
      ['IContentProvider', 'call'],
      [
        {
          ...range('8', 'O', 26, 'android-8.0.0_r1', [methodA]),
          fromTagPosition: 'first-checked',
          toTagPosition: 'last-checked',
        },
        {
          ...range('10', 'Q', 29, 'android-10.0.0_r1', [methodA, methodB]),
          fromTagPosition: 'first-checked',
          toTagPosition: 'last-checked',
        },
        {
          ...range('11', 'R', 30, 'android-11.0.0_r1', [methodA, methodC]),
          fromTagPosition: 'first-checked',
          toTagPosition: 'last-checked',
        },
        {
          ...range('12', 'S', 31, 'android-12.0.0_r1', [methodA, methodD]),
          fromTagPosition: 'first-checked',
          toTagPosition: 'last-checked',
        },
      ],
      [{ name: 'IContentProvider', kind: 'interface' }],
    ),
  );

  assert.match(result.code, /import android\.os\.Build;/);
  assert.match(result.code, /import androidx\.annotation\.DeprecatedSinceApi;/);
  assert.match(result.code, /import androidx\.annotation\.RequiresApi;/);
  assert.doesNotMatch(result.code, /^\s*\/\/ /m);
  assert.match(
    result.code,
    /@RequiresApi\(Build\.VERSION_CODES\.Q\)\n\s+@DeprecatedSinceApi\(api = Build\.VERSION_CODES\.R\)\n\s+String call\(String callingPkg, String authority\);/,
  );
  assert.match(
    result.code,
    /@RequiresApi\(Build\.VERSION_CODES\.R\)\n\s+@DeprecatedSinceApi\(api = Build\.VERSION_CODES\.S\)\n\s+String call\(String callingPkg, String attributionTag, String authority\);/,
  );
  assert.match(
    result.code,
    /@RequiresApi\(Build\.VERSION_CODES\.S\)\n\s+String call\(String attributionSource, String authority, String method, String arg\);/,
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
  methodA.imports = [0];
  methodB.imports = [0];
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
      undefined,
      ['android.content.pm.UserInfo'],
    ),
  );

  assert.equal(result.declarations.length, 2);
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
  const legacyMethod = method(
    'void',
    [
      { name: 'packageName', type: 'String' },
      { name: 'permissionName', type: 'String' },
      { name: 'userId', type: 'int' },
      { name: 'reason', type: 'String' },
    ],
    'revokeRuntimePermission',
  );
  const deviceIdMethod = method(
    'void',
    [
      { name: 'packageName', type: 'String' },
      { name: 'permissionName', type: 'String' },
      { name: 'deviceId', type: 'int' },
      { name: 'userId', type: 'int' },
      { name: 'reason', type: 'String' },
    ],
    'revokeRuntimePermission',
  );
  const persistentDeviceIdMethod = method(
    'void',
    [
      { name: 'packageName', type: 'String' },
      { name: 'permissionName', type: 'String' },
      { name: 'persistentDeviceId', type: 'String' },
      { name: 'userId', type: 'int' },
      { name: 'reason', type: 'String' },
    ],
    'revokeRuntimePermission',
  );
  const result = renderAndroidApiCode(
    baseResult(
      'IPermissionManager.revokeRuntimePermission',
      'core/java/android/permission/IPermissionManager.aidl',
      ['IPermissionManager', 'revokeRuntimePermission'],
      [
        {
          ...rangeSpan(
            '11',
            'R',
            30,
            'android-11.0.0_r1',
            '14',
            'UPSIDE_DOWN_CAKE',
            34,
            'android-14.0.0_r28',
            [legacyMethod],
          ),
          fromTagPosition: 'first-checked' as const,
        },
        rangeSpan(
          '14',
          'UPSIDE_DOWN_CAKE',
          34,
          'android-14.0.0_r29',
          '14',
          'UPSIDE_DOWN_CAKE',
          34,
          'android-14.0.0_r37',
          [deviceIdMethod],
        ),
        rangeSpan(
          '14',
          'UPSIDE_DOWN_CAKE',
          34,
          'android-14.0.0_r38',
          '14',
          'UPSIDE_DOWN_CAKE',
          34,
          'android-14.0.0_r45',
          [legacyMethod],
        ),
        rangeSpan(
          '14',
          'UPSIDE_DOWN_CAKE',
          34,
          'android-14.0.0_r46',
          '14',
          'UPSIDE_DOWN_CAKE',
          34,
          'android-14.0.0_r49',
          [],
          'source-file-not-found',
        ),
        {
          ...rangeSpan(
            '14',
            'UPSIDE_DOWN_CAKE',
            34,
            'android-14.0.0_r50',
            '17',
            'CINNAMON_BUN',
            37,
            'android-17.0.0_r1',
            [persistentDeviceIdMethod],
          ),
          toTagPosition: 'last-checked' as const,
        },
      ],
    ),
  );

  assert.equal(result.declarations.length, 3);
  assert.doesNotMatch(result.code, /@RequiresApi/);
  assert.doesNotMatch(result.code, /@DeprecatedSinceApi/);
  assert.doesNotMatch(result.code, /androidx\.annotation\.RequiresApi/);
  assert.doesNotMatch(result.code, /import android\.os\.Build;/);
  assert.match(
    result.code,
    /\/\/ 11 - 14\.0\.0_r28, 14\.0\.0_r38 - 14\.0\.0_r45\n\s+void revokeRuntimePermission\(String packageName, String permissionName, int userId, String reason\);/,
  );
  assert.match(
    result.code,
    /\/\/ 14\.0\.0_r29 - 14\.0\.0_r37\n\s+void revokeRuntimePermission\(String packageName, String permissionName, int deviceId, int userId, String reason\);/,
  );
  assert.match(
    result.code,
    /\/\/ 14\.0\.0_r50 - 17\n\s+void revokeRuntimePermission\(String packageName, String permissionName, String persistentDeviceId, int userId, String reason\);/,
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
        {
          ...range('10', 'Q', 29, 'android-10.0.0_r1', [methodA]),
          fromTagPosition: 'first-checked',
          toTagPosition: 'last-checked',
        },
        {
          ...range('12', 'S', 31, 'android-12.0.0_r1', [methodB]),
          fromTagPosition: 'first-checked',
          toTagPosition: 'last-checked',
        },
        {
          ...range('13', 'TIRAMISU', 33, 'android-13.0.0_r1', [methodC]),
          fromTagPosition: 'first-checked',
        },
        range('13', 'TIRAMISU', 33, 'android-13.0.0_r2', [methodC]),
        {
          ...range('13', 'TIRAMISU', 33, 'android-13.0.0_r3', [methodB]),
          toTagPosition: 'last-checked',
        },
      ],
    ),
  );

  assert.equal(result.declarations.length, 3);
  assert.match(result.code, /^package android\.app;/);
  assert.match(result.code, /import android\.os\.Binder;/);
  assert.match(result.code, /import android\.os\.IBinder;/);
  assert.match(result.code, /import android\.os\.IInterface;/);
  assert.match(result.code, /import java\.util\.List;/);
  assert.doesNotMatch(result.code, /androidx\.annotation\.RequiresApi/);
  assert.doesNotMatch(result.code, /androidx\.annotation\.DeprecatedSinceApi/);
  assert.doesNotMatch(result.code, /import android\.os\.Build;/);
  assert.match(
    result.code,
    /\/\/ 10\n\s+List<ActivityManager\.RunningTaskInfo> getTasks\(int maxNum\);/,
  );
  assert.match(
    result.code,
    /\/\/ 12, 13\.0\.0_r3\n\s+List<ActivityManager\.RunningTaskInfo> getTasks\(int maxNum, boolean filterOnlyVisibleRecents, boolean keepIntentExtra\);/,
  );
  assert.match(
    result.code,
    /\/\/ 13 - 13\.0\.0_r2\n\s+List<ActivityManager\.RunningTaskInfo> getTasks\(int maxNum, boolean filterOnlyVisibleRecents, boolean keepIntentExtra, int displayId\);/,
  );
}

{
  const staticField: AndroidApiMemberResult = {
    kind: 'field',
    name: 'STATE',
    type: 'int',
    imports: [],
    isStatic: true,
  };
  const result = renderAndroidApiCode(
    baseResult(
      'Example.FLAG',
      'core/java/android/example/Example.java',
      ['Example', 'FLAG'],
      [
        range('14', 'UPSIDE_DOWN_CAKE', 34, 'android-14.0.0_r1', [
          constant(),
          staticField,
        ]),
      ],
      [{ name: 'Example', kind: 'class' }],
    ),
  );
  assert.match(result.code, /public static int FLAG;/);
  assert.match(result.code, /public static int STATE;/);
  assert.doesNotMatch(result.code, /static final/);
  assert.doesNotMatch(result.code, /(FLAG|STATE)\s*=/);
}

{
  const useFoo = method('void', [{ name: 'value', type: 'A' }], 'useFoo');
  useFoo.imports = [0];
  const useBar = method('void', [{ name: 'value', type: 'A' }], 'useBar');
  useBar.imports = [1];
  const result = renderAndroidApiCode(
    baseResult(
      'ImportConflict',
      'core/java/android/example/ImportConflict.java',
      ['ImportConflict'],
      [
        range('14', 'UPSIDE_DOWN_CAKE', 34, 'android-14.0.0_r1', [
          useFoo,
          useBar,
        ]),
      ],
      [{ name: 'ImportConflict', kind: 'class' }],
      ['foo.A', 'bar.A'],
    ),
  );
  assert.doesNotMatch(result.code, /import foo\.A;/);
  assert.doesNotMatch(result.code, /import bar\.A;/);
  assert.match(result.code, /useFoo\(foo\.A value\)/);
  assert.match(result.code, /useBar\(bar\.A value\)/);
}

{
  const getValue = method('String', [], 'getValue');
  const internalAndroid13Range = rangeSpan(
    '13',
    'TIRAMISU',
    33,
    'android-13.0.0_r2',
    '13',
    'TIRAMISU',
    33,
    'android-13.0.0_r15',
    [getValue],
  );
  const android14MissingRange: AndroidApiVersionRangeResult = {
    ...range(
      '14',
      'UPSIDE_DOWN_CAKE',
      34,
      'android-14.0.0_r1',
      [],
      'api-not-found',
    ),
    fromTagPosition: 'first-checked',
    toTagPosition: 'last-checked',
  };
  const android15Range: AndroidApiVersionRangeResult = {
    ...range('15', 'VANILLA_ICE_CREAM', 35, 'android-15.0.0_r1', [getValue]),
    fromTagPosition: 'first-checked',
    toTagPosition: 'last-checked',
  };
  const result = renderAndroidApiCode(
    baseResult(
      'Example.getValue',
      'core/java/android/app/Example.java',
      ['Example', 'getValue'],
      [internalAndroid13Range, android14MissingRange, android15Range],
    ),
  );

  assert.match(
    result.code,
    /\/\/ 13\.0\.0_r2 - 13\.0\.0_r15, 15\n\s+public String getValue\(\)/,
  );
  assert.doesNotMatch(result.code, /\/\/ 13, 15/);
}

console.log('code-render tests passed');
