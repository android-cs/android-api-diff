import process from 'node:process';
import { loadAndroidVersionList } from '@android-cs/api-query';

const NETWORK_RETRY_COUNT = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getFetchHeaders = (url: string): HeadersInit | undefined => {
  if (process.env.GITHUB_TOKEN && url.startsWith('https://api.github.com/')) {
    return {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
    };
  }
};

const fetchTextWithRetry = async (
  url: string,
  init?: RequestInit,
): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(url, init);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt === NETWORK_RETRY_COUNT) break;
      await sleep(NETWORK_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Fetch failed for ${url}`);
};

const androidVersionList = await loadAndroidVersionList({
  fetchText: (url) => fetchTextWithRetry(url, { headers: getFetchHeaders(url) }),
});

export default androidVersionList;
