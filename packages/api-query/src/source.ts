import type { AndroidApiQueryRuntime } from './types.ts';
import { loadCachedTaggedSourceText } from './taggedSourceCache.ts';
import { getMirrorContentUrl, mirrorContentBaseUrl } from './url.ts';

const androidTagReg = /^android-\d+\.\d+\.\d+_r\d+$/;
const invalidSourcePathCharacterReg = /[%?#\u0000-\u001f\u007f]/;

export interface AndroidApiSourceFile {
  content: string;
  path: string;
  tag: string;
  url: string;
}

export class AndroidApiSourceFileNotFoundError extends Error {
  readonly code = 'SOURCE_NOT_FOUND';
}

export const normalizeAndroidSourceTag = (
  value: string,
): string | undefined => {
  const tag = value.trim();
  return androidTagReg.test(tag) ? tag : undefined;
};

export const normalizeAndroidSourceFilePath = (
  value: string,
): string | undefined => {
  let filePath = value.trim().replaceAll('\\', '/');
  if (!filePath || invalidSourcePathCharacterReg.test(filePath)) return;
  filePath = filePath.replace(/^\/+/, '');
  if (filePath.startsWith('frameworks/base/')) {
    filePath = filePath.substring('frameworks/base/'.length);
  }
  const segments = filePath.split('/');
  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return;
  }
  return filePath;
};

const getValidatedContentUrl = (tag: string, filePath: string): string => {
  const encodedFilePath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const contentUrl = new URL(
    getMirrorContentUrl(`${encodeURIComponent(tag)}/${encodedFilePath}`),
  );
  const contentBaseUrl = new URL(mirrorContentBaseUrl);
  const expectedPathPrefix = `${contentBaseUrl.pathname}${encodeURIComponent(tag)}/`;
  if (
    contentUrl.protocol !== contentBaseUrl.protocol ||
    contentUrl.hostname !== contentBaseUrl.hostname ||
    contentUrl.port !== contentBaseUrl.port ||
    !contentUrl.pathname.startsWith(expectedPathPrefix)
  ) {
    throw new TypeError('Source URL escaped the configured framework mirror');
  }
  return contentUrl.href;
};

export const loadAndroidSourceFile = async (
  runtime: AndroidApiQueryRuntime,
  tagValue: string,
  filePathValue: string,
  signal?: AbortSignal,
): Promise<AndroidApiSourceFile> => {
  const tag = normalizeAndroidSourceTag(tagValue);
  if (!tag) {
    throw new TypeError(
      'Source tag must match android-<major>.<minor>.<patch>_r<revision>',
    );
  }
  const filePath = normalizeAndroidSourceFilePath(filePathValue);
  if (!filePath) {
    throw new TypeError('Source file path must stay within frameworks/base');
  }

  signal?.throwIfAborted();
  const taggedFilePath = `${tag}/${filePath}`;
  const url = getValidatedContentUrl(tag, filePath);
  const { sourceFileNotFound, text: content } =
    await loadCachedTaggedSourceText(runtime, taggedFilePath, url, signal);
  if (sourceFileNotFound) {
    throw new AndroidApiSourceFileNotFoundError(
      `Source file not found: ${taggedFilePath}`,
    );
  }
  return { content, path: filePath, tag, url };
};
