import type {
  AndroidApiResolution,
  FileTarget,
  SearchFromData,
} from './types.ts';
import { fixFilePath, getMirrorContentUrl, getSourceTargetUrl } from './url.ts';

const aidlFileNameRegs = [/^I[A-Z].*/, /\.I[A-Z].*/];
const sourceFileReg = /\.(java|aidl)$/;
const propReg = /^[_0-9a-zA-Z]+/;

const getFileStructName = (filePath: string): string => {
  return filePath.split('/').at(-1)!.replace(sourceFileReg, '');
};

export interface AndroidSourceFileRedirect {
  fromPath: string;
  toPath: string;
  minApiVersion: number;
  maxApiVersion: number;
}

// Register exceptional historical source moves here. The first matching rule wins.
export const androidSourceFileRedirects = [
  {
    fromPath: 'core/java/android/os/BinderProxy.java',
    toPath: 'core/java/android/os/Binder.java',
    minApiVersion: 26,
    maxApiVersion: 28,
  },
] as const satisfies readonly AndroidSourceFileRedirect[];

export const redirectAndroidSourceFilePath = (
  filePath: string,
  apiVersion: number,
  redirects: readonly AndroidSourceFileRedirect[] = androidSourceFileRedirects,
): string => {
  const redirect = redirects.find(
    (item) =>
      item.fromPath === filePath &&
      apiVersion >= item.minApiVersion &&
      apiVersion <= item.maxApiVersion,
  );
  return redirect?.toPath ?? filePath;
};

const getMayFileRefNames = (name: string): string[] => {
  const r = new Set<string>([name]);
  const parts = name.split('.');
  const lastPart = parts.at(-1);
  if (lastPart?.endsWith('Hidden')) {
    parts[parts.length - 1] = lastPart.substring(
      0,
      lastPart.length - 'Hidden'.length,
    );
    r.add(parts.join('.'));
  }
  return Array.from(r);
};

const getPropName = (name: string): string => {
  return name.match(propReg)?.[0] || '';
};

const isLikelyMemberName = (name: string): boolean => {
  if (!name) return false;
  return /^[a-z_]/.test(name) || /^[A-Z0-9_]+$/.test(name);
};

export const searchFilePathByName = (
  name: string,
  aidlJavaFiles: readonly string[],
): string | undefined => {
  name = fixFilePath(name.trim()).replaceAll('\\', '/').replace(/^\/+/, '');
  if (name.startsWith('frameworks/base/')) {
    name = name.substring('frameworks/base/'.length);
  }
  if (!name) return;
  if (name.endsWith('.java') || name.endsWith('.aidl')) {
    const a = `/${name}`;
    return aidlJavaFiles.find((v) => v === name || v.endsWith(a));
  }
  const perfAidl = aidlFileNameRegs.some((reg) => name.match(reg));
  name = name.replaceAll('.', '/');
  let a = '';
  if (perfAidl) {
    a = `/${name}.aidl`;
  } else {
    a = `/${name}.java`;
  }
  const ra = aidlJavaFiles.find((v) => v.endsWith(a));
  if (ra) return ra;
  if (!perfAidl) {
    a = `/${name}.aidl`;
  } else {
    a = `/${name}.java`;
  }
  return aidlJavaFiles.find((v) => v.endsWith(a));
};

const getConstructorShorthandClassName = (
  name: string,
  aidlJavaFiles: readonly string[],
): string | undefined => {
  if (!name.endsWith('()')) return;
  const className = name.substring(0, name.length - 2).trim();
  if (/[#?;]/.test(className)) return;
  const simpleName = className.replaceAll('$', '.').split('.').at(-1);
  if (!simpleName) return;
  if (
    isLikelyMemberName(simpleName) &&
    !searchFilePathByName(className, aidlJavaFiles)
  ) {
    return;
  }
  return className;
};

const isConstructorShorthand = (
  name: string,
  aidlJavaFiles: readonly string[],
): boolean => {
  return (
    getConstructorShorthandClassName(name.trim(), aidlJavaFiles) !== undefined
  );
};

export const isConstructorReference = (
  name: string,
  aidlJavaFiles: readonly string[],
  search: SearchFromData | undefined,
): boolean => {
  if (isConstructorShorthand(name, aidlJavaFiles)) return true;
  if (!name.includes('#') || search?.targetKind !== 'member') return false;
  return search.targetPaths.at(-1) === search.targetPaths.at(-2);
};

export const resolveFileTargets = (
  name: string,
  aidlJavaFiles: readonly string[],
): FileTarget[] => {
  name = name.replaceAll('$', '.').replace(/\.+$/g, '').trim();
  if (!name) return [];
  const parts = name.split('.').filter(Boolean);
  const res: FileTarget[] = [];
  const seen = new Set<string>();
  for (let i = parts.length; i > 0; i--) {
    const fileRef = parts.slice(0, i).join('.');
    const suffix = parts.slice(i);
    for (const mayFileRef of getMayFileRefNames(fileRef)) {
      const filePath = searchFilePathByName(mayFileRef, aidlJavaFiles);
      if (!filePath) continue;
      const targetPaths = [getFileStructName(filePath), ...suffix];
      const key = `${filePath}\n${targetPaths.join('.')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      res.push({
        filePath,
        targetPaths,
      });
    }
  }
  return res;
};

const createSearchFromData = (
  filePath: string,
  targetPaths: string[],
  targetKind: SearchFromData['targetKind'],
): SearchFromData => {
  return {
    filePath,
    targetUrl: getSourceTargetUrl(filePath),
    targetPaths,
    targetKind,
  };
};

export const toAndroidApiResolution = (
  search: SearchFromData | undefined,
): AndroidApiResolution | undefined => {
  if (!search) return;
  return {
    source: {
      repo: 'platform/frameworks/base',
      path: search.filePath,
      url: getMirrorContentUrl(`:tag/${search.filePath}`),
    },
    resolvedTarget: {
      kind: search.targetKind,
      paths: search.targetPaths,
    },
  };
};

export const searchFilePathByRefName = (
  name: string,
  aidlJavaFiles: readonly string[],
): SearchFromData | undefined => {
  name = name.trim();
  if (!name) return;

  const fileName = fixFilePath(name);
  if (sourceFileReg.test(fileName)) {
    const filePath = searchFilePathByName(fileName, aidlJavaFiles);
    if (filePath) {
      return createSearchFromData(filePath, [], 'file');
    }
  }

  const constructorClassName = getConstructorShorthandClassName(
    name,
    aidlJavaFiles,
  );
  if (constructorClassName) {
    for (const target of resolveFileTargets(
      constructorClassName,
      aidlJavaFiles,
    )) {
      const constructorName = target.targetPaths.at(-1);
      if (!constructorName) continue;
      return createSearchFromData(
        target.filePath,
        [...target.targetPaths, constructorName],
        'member',
      );
    }
  }

  let className = name;
  let propName = '';
  if (name.includes('#')) {
    const parts = name.split('#', 2);
    className = parts[0];
    propName = getPropName(parts[1] || '');
  } else if (name.includes('.')) {
    const i = name.lastIndexOf('.');
    const mayPropName = getPropName(name.substring(i + 1));
    if (isLikelyMemberName(mayPropName)) {
      className = name.substring(0, i);
      propName = mayPropName;
    }
  }

  if (propName) {
    for (const target of resolveFileTargets(className, aidlJavaFiles)) {
      return createSearchFromData(
        target.filePath,
        [...target.targetPaths, propName],
        'member',
      );
    }
    return;
  }

  for (const target of resolveFileTargets(className, aidlJavaFiles)) {
    return createSearchFromData(target.filePath, target.targetPaths, 'class');
  }
};
