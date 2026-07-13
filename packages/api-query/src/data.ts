import {
  aidlJavaFileListUrl,
  androidVersionInfos,
  manualTagMirrors,
} from './constants.ts';
import type { AndroidApiQueryRuntime, AndroidVersionItem } from './types.ts';

const tagReg = /^android-\d+\.\d+\.\d+_r\d+$/;
const xssiPrefix = `)]}'\n`;

interface GoogleSourceTagsResponse {
  [tag: string]: {
    peeled: string;
    value: string;
  };
}

interface GitHubTagRef {
  ref: string;
}

const fetchCachedText = async (
  runtime: AndroidApiQueryRuntime,
  key: string,
  url: string,
): Promise<string> => {
  const cached = await runtime.textCache?.get(key);
  if (cached !== undefined) return cached;
  const value = await runtime.fetchText(url);
  await runtime.textCache?.set(key, value);
  return value;
};

const getSourceProvider = (runtime: AndroidApiQueryRuntime) => {
  return runtime.sourceProvider ?? 'github';
};

const parseGitHubTags = (text: string): string[] | undefined => {
  const value = JSON.parse(text) as unknown;
  if (!Array.isArray(value)) return;
  return value
    .map((item) => (item as Partial<GitHubTagRef>).ref)
    .filter((ref): ref is string => typeof ref === 'string')
    .map((ref) => ref.substring('refs/tags/'.length))
    .filter((tag) => tagReg.test(tag));
};

export const loadAidlJavaFiles = async (
  runtime: AndroidApiQueryRuntime,
): Promise<string[]> => {
  const runtimeFiles = await runtime.loadAidlJavaFiles?.();
  if (runtimeFiles) return runtimeFiles;
  const text = await fetchCachedText(
    runtime,
    'file-list:aidl-java-files:v1',
    aidlJavaFileListUrl,
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
): Promise<AndroidVersionItem[]> => {
  const runtimeVersionList = await runtime.loadAndroidVersionList?.();
  if (runtimeVersionList) return runtimeVersionList;
  const googleTagsText = await fetchCachedText(
    runtime,
    'tag-list:googlesource:frameworks-base:v1',
    'https://android.googlesource.com/platform/frameworks/base/+refs/tags/?format=JSON',
  );
  const googleTags = Object.keys(
    JSON.parse(
      googleTagsText.substring(xssiPrefix.length),
    ) as GoogleSourceTagsResponse,
  ).filter((v) => tagReg.test(v));

  const availableTags =
    getSourceProvider(runtime) === 'googlesource'
      ? googleTags
      : await (async () => {
          const githubTagsText = await fetchCachedText(
            runtime,
            'tag-list:github:aosp-mirror-frameworks-base:v1',
            'https://api.github.com/repos/aosp-mirror/platform_frameworks_base/git/refs/tags',
          );
          const githubTags = parseGitHubTags(githubTagsText) ?? googleTags;
          const customAvailableTags = manualTagMirrors.map(([tag]) => tag);
          return Array.from(new Set([...githubTags, ...customAvailableTags]));
        })();
  const minApiVersion = androidVersionInfos[0].apiVersion;
  const androidVersionInfoMap = new Map<string, AndroidVersionItem>(
    androidVersionInfos.map((info) => [
      info.version,
      { ...info, tags: [], futureTags: [] },
    ]),
  );

  const versionTags: Record<string, string[]> = {};
  googleTags.forEach((v) => {
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
      const futureTags = alltag.filter((v) => !availableTags.includes(v));
      const tags = alltag.filter((v) => availableTags.includes(v));
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
