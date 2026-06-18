import process from 'node:process';
import { androidVersionInfos, manualTagMirrors } from './constants';

const tagReg = /^android-\d+\.\d+\.\d+_r\d+$/;
const xssiPrefix = `)]}'\n`;

const customAvailableTags = manualTagMirrors.map(([tag]) => tag);
const minApiVersion = androidVersionInfos[0].apiVersion;
const androidVersionInfoMap = new Map<
  string,
  (typeof androidVersionInfos)[number]
>(androidVersionInfos.map((info) => [info.version, info]));

interface IGoogleSourceTagsResponse {
  [tag: string]: {
    peeled: string;
    value: string;
  };
}

const googleTags = await fetch(
  'https://android.googlesource.com/platform/frameworks/base/+refs/tags/?format=JSON',
)
  .then((r) => r.text())
  .then<IGoogleSourceTagsResponse>((r) => {
    return JSON.parse(r.substring(xssiPrefix.length));
  })
  .then((r) => Object.keys(r).filter((v) => tagReg.test(v)));

// use GITHUB_TOKEN to avoid API rate limit exceeded
const githubTags = await fetch(
  'https://api.github.com/repos/aosp-mirror/platform_frameworks_base/git/refs/tags',
  {
    headers: process.env.GITHUB_TOKEN
      ? {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
        }
      : undefined,
  },
)
  .then<{ ref: string }[]>((r) => r.json())
  .then((r) => {
    return r
      .map((v) => v.ref.substring('refs/tags/'.length))
      .filter((v) => tagReg.test(v));
  });
const availableTags = Array.from(
  new Set([...githubTags, ...customAvailableTags]),
);

const versionTags: Record<string, string[]> = {};
googleTags.forEach((v) => {
  const vserion = v
    .split('.')
    .slice(0, 2)
    .join('.')
    .replace('android-', '')
    .replace('.0', '');
  let tempList = versionTags[vserion];
  if (!tempList) {
    tempList = [];
    versionTags[vserion] = tempList;
  }
  tempList.push(v);
});
const androidVersionList = Object.entries(versionTags)
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

export default androidVersionList;
