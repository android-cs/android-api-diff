import { manualTagMirrors } from './constants.ts';
import type { VersionUrlBuilder } from './types.ts';

const sourceBaseurl = 'https://android.googlesource.com/';
const sourceRegs = [
  /\/\+\/refs\/heads\/[^\/]+(.*)$/g,
  /\/\+\/refs\/tags\/[^\/]+(.*)$/g,
  /\/\+\/[^\/]+(.*)$/g,
];

const csBaseUrl = 'https://cs.android.com/';
const csReg = /\/\+\/[^\/\:]+\:?(.*)$/g;

const mirrorBaseUrl =
  'https://github.com/aosp-mirror/platform_frameworks_base/';
const mirrorRegs = [
  /\/blob\/[^\/]+(.*)$/g,
  /\/tree\/[^\/]+(.*)$/g,
  /\/raw\/[^\/]+(.*)$/g,
];

export const mirrorContentBaseUrl =
  'https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/';
const mirrorContentRegs = [
  /\/refs\/heads\/[^\/]+(.*)$/g,
  /\/refs\/tags\/[^\/]+(.*)$/g,
  /\/[0-9a-f]{40}(.*)$/g,
  /\/aosp\-mirror\/platform_frameworks_base\/[^\/]+(.*)$/g,
];

export const sourceLinkTargetOptions = [
  'cs.android.com',
  'googlesource',
  'github',
] as const;
export type SourceLinkTarget = (typeof sourceLinkTargetOptions)[number];
export const DEFAULT_SOURCE_LINK_TARGET: SourceLinkTarget = 'cs.android.com';

export const getGoogleSourceUrl = (filePath: string): string => {
  const tagEnd = filePath.indexOf('/');
  if (tagEnd < 0) return sourceBaseurl;
  const tag = filePath.substring(0, tagEnd);
  const sourcePath = filePath.substring(tagEnd);
  return `${sourceBaseurl}platform/frameworks/base/+/refs/tags/${tag}${sourcePath}`;
};

export const getMirrorContentUrl = (filePath: string): string => {
  for (const [tag, baseUrl] of manualTagMirrors) {
    const tagPrefix = `${tag}/`;
    if (filePath.startsWith(tagPrefix)) {
      return baseUrl + filePath.substring(tagPrefix.length);
    }
  }
  return mirrorContentBaseUrl + filePath;
};

export const getMirrorSourceUrl = (filePath: string): string => {
  const contentUrl = getMirrorContentUrl(filePath);
  const path = contentUrl.substring(mirrorContentBaseUrl.indexOf('//') + 2);
  const [host, owner, repository, ...refAndFilePath] = path.split('/');
  if (
    host !== 'raw.githubusercontent.com' ||
    !owner ||
    !repository ||
    refAndFilePath.length === 0
  ) {
    return contentUrl;
  }
  return `https://github.com/${owner}/${repository}/blob/${refAndFilePath.join('/')}`;
};

export const fixFilePath = (filePath: string): string => {
  const a1 = filePath.indexOf(';');
  if (a1 >= 0) {
    filePath = filePath.substring(0, a1);
  }
  const a2 = filePath.indexOf('?');
  if (a2 >= 0) {
    filePath = filePath.substring(0, a2);
  }
  const a3 = filePath.indexOf('#');
  if (a3 >= 0) {
    filePath = filePath.substring(0, a3);
  }
  return filePath;
};

export const getVersionUrlBuilder = (
  url: string,
): VersionUrlBuilder | undefined => {
  url = fixFilePath(url.trim());
  if (url.startsWith(sourceBaseurl)) {
    const repository = url.substring(sourceBaseurl.length, url.indexOf('/+/'));
    if (!repository) {
      return;
    }
    const filePath = (() => {
      for (const reg of sourceRegs) {
        reg.lastIndex = 0;
        const r = reg.exec(url)?.[1];
        if (r === undefined) continue;
        return r;
      }
    })();
    if (filePath === undefined) return;
    return {
      filePath,
      templateUrl: [sourceBaseurl + repository + `/+/`, filePath],
    };
  } else if (url.startsWith(csBaseUrl)) {
    url = url.replace('/main/+/', '/+/');
    csReg.lastIndex = 0;
    const r = csReg.exec(url);
    if (!r) return;
    const baseUrl = url.substring(0, r.index);
    const filePath = r[1];
    let actualFilePath = '';
    if (filePath.startsWith('frameworks/base/')) {
      actualFilePath = filePath.substring('frameworks/base/'.length);
      actualFilePath = '/' + actualFilePath;
    }
    return {
      filePath: actualFilePath,
      templateUrl: [baseUrl + `/+/`, filePath && ':' + filePath],
    };
  } else if (url.startsWith(mirrorBaseUrl)) {
    const filePath = (() => {
      for (const reg of mirrorRegs) {
        reg.lastIndex = 0;
        const r = reg.exec(url)?.[1];
        if (r === undefined) continue;
        return r;
      }
    })();
    if (filePath === undefined) return;
    const type = url
      .substring(mirrorBaseUrl.length, url.indexOf(filePath))
      .split('/')[0];
    return {
      filePath,
      templateUrl: [mirrorBaseUrl + type + `/`, filePath],
    };
  } else if (url.startsWith(mirrorContentBaseUrl)) {
    const filePath = (() => {
      for (const reg of mirrorContentRegs) {
        reg.lastIndex = 0;
        const r = reg.exec(url)?.[1];
        if (r === undefined) continue;
        return r;
      }
    })();
    if (filePath === undefined) return;
    return {
      filePath,
      templateUrl: [mirrorContentBaseUrl, filePath],
    };
  }
};

export const getSourceUrlWithLine = (u: string, line: number): string => {
  if (u.startsWith(csBaseUrl)) {
    return `${u};l=${line}`;
  }
  if (u.startsWith('https://github.com/')) {
    return `${u}#L${line}`;
  }
  if (u.startsWith(sourceBaseurl)) {
    return `${u}#${line}`;
  }
  return u;
};

export const getSourceTargetUrl = (filePath: string): string => {
  return `${csBaseUrl}android/platform/superproject/+/android-latest-release:frameworks/base/${filePath}`;
};
