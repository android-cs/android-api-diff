import {
  aidlJavaFileListUrl,
  androidVersionInfos,
  manualTagMirrors,
} from './constants.ts';
import type { AndroidApiQueryRuntime, AndroidVersionItem } from './types.ts';

const gitHubTagsUrl =
  'https://github.com/msft-mirror-aosp/platform.frameworks.base.git/info/refs?service=git-upload-pack';
const googleSourceTagsUrl =
  'https://android.googlesource.com/platform/frameworks/base/+refs/tags/?format=JSON';
const gitHubTagRefReg = /refs\/tags\/(android-\d+\.\d+\.\d+_r\d+)/g;
const tagReg = /^android-\d+\.\d+\.\d+_r\d+$/;
const xssiPrefix = `)]}'\n`;

interface GoogleSourceTagsResponse {
  [tag: string]: {
    peeled: string;
    value: string;
  };
}

const fetchCachedText = async (
  runtime: AndroidApiQueryRuntime,
  key: string,
  url: string,
  signal?: AbortSignal,
): Promise<string> => {
  const cached = await runtime.textCache?.get(key);
  if (cached !== undefined) return cached;
  const value = await runtime.fetchText(url, signal);
  await runtime.textCache?.set(key, value);
  return value;
};

const parseGitHubTags = (text: string): string[] => {
  const tags = Array.from(
    new Set(Array.from(text.matchAll(gitHubTagRefReg), (match) => match[1]!)),
  );
  if (tags.length === 0) {
    throw new Error('GitHub returned an invalid Android tag list');
  }
  return tags;
};

const parseGoogleSourceTags = (text: string): string[] => {
  if (!text.startsWith(xssiPrefix)) {
    throw new Error('Google Source returned an invalid Android tag list');
  }
  const value = JSON.parse(
    text.substring(xssiPrefix.length),
  ) as GoogleSourceTagsResponse;
  const tags = Object.keys(value).filter((tag) => tagReg.test(tag));
  if (tags.length === 0) {
    throw new Error('Google Source returned an invalid Android tag list');
  }
  return tags;
};

export const loadAidlJavaFiles = async (
  runtime: AndroidApiQueryRuntime,
  signal?: AbortSignal,
): Promise<string[]> => {
  const runtimeFiles = await runtime.loadAidlJavaFiles?.(signal);
  if (runtimeFiles) return runtimeFiles;
  const text = await fetchCachedText(
    runtime,
    'file-list:aidl-java-files:v1',
    aidlJavaFileListUrl,
    signal,
  );
  const files = text.split('\n').filter(Boolean).sort();
  const normalFiles: string[] = [];
  const laterFiles: string[] = [];
  for (const file of files) {
    if (file.includes('/test/') || file.includes('/tests/')) {
      laterFiles.push(file);
    } else {
      normalFiles.push(file);
    }
  }
  return normalFiles.concat(laterFiles);
};

export const loadAndroidVersionList = async (
  runtime: AndroidApiQueryRuntime,
  signal?: AbortSignal,
): Promise<AndroidVersionItem[]> => {
  const runtimeVersionList = await runtime.loadAndroidVersionList?.(signal);
  if (runtimeVersionList) return runtimeVersionList;
  const [googleSourceTagsText, githubTagsText] = await Promise.all([
    fetchCachedText(
      runtime,
      'tag-list:googlesource:frameworks-base:v1',
      googleSourceTagsUrl,
      signal,
    ),
    fetchCachedText(
      runtime,
      'tag-list:github:msft-mirror-aosp-frameworks-base:git-upload-pack:v1',
      gitHubTagsUrl,
      signal,
    ),
  ]);
  const googleSourceTags = parseGoogleSourceTags(googleSourceTagsText);
  const githubTags = parseGitHubTags(githubTagsText);
  const customAvailableTags = manualTagMirrors.map(([tag]) => tag);
  const availableTags = Array.from(
    new Set([...githubTags, ...customAvailableTags]),
  );
  const knownTags = Array.from(
    new Set([...googleSourceTags, ...githubTags, ...customAvailableTags]),
  );
  const minApiVersion = androidVersionInfos[0].apiVersion;
  const androidVersionInfoMap = new Map<string, AndroidVersionItem>(
    androidVersionInfos.map((info) => [
      info.version,
      { ...info, tags: [], futureTags: [] },
    ]),
  );

  const versionTags: Record<string, string[]> = {};
  knownTags.forEach((v) => {
    const version = v
      .split('.')
      .slice(0, 2)
      .join('.')
      .replace('android-', '')
      .replace('.0', '');
    let tempList = versionTags[version];
    if (!tempList) {
      tempList = [];
      versionTags[version] = tempList;
    }
    tempList.push(v);
  });
  return Object.entries(versionTags)
    .filter(([version]) => {
      const info = androidVersionInfoMap.get(version);
      return info !== undefined && info.apiVersion >= minApiVersion;
    })
    .map<AndroidVersionItem>(([version, alltag]) => {
      const info = androidVersionInfoMap.get(version);
      alltag.sort((a, b) => {
        const ra = Number(a.split('_r')[1]);
        const rb = Number(b.split('_r')[1]);
        return ra - rb;
      });
      const tags = alltag.filter((tag) => availableTags.includes(tag));
      const futureTags = alltag.filter((tag) => !availableTags.includes(tag));
      return {
        version,
        alias: info?.alias ?? '',
        apiVersion: info?.apiVersion ?? 0,
        tags,
        futureTags,
      };
    })
    .sort((a, b) => a.apiVersion - b.apiVersion);
};
