import { setTimeout as sleep } from 'node:timers/promises';

const NETWORK_RETRY_COUNT = 3;
const NETWORK_RETRY_BASE_DELAY_MS = 300;

const fetchTextOnce = async (
  url: string,
  signal?: AbortSignal,
): Promise<string> => {
  const response = await fetch(url, { signal });
  return response.text();
};

export const fetchTextWithRetry = async (
  url: string,
  signal?: AbortSignal,
): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= NETWORK_RETRY_COUNT; attempt++) {
    signal?.throwIfAborted();
    try {
      return await fetchTextOnce(url, signal);
    } catch (error) {
      lastError = error;
      signal?.throwIfAborted();
      if (attempt === NETWORK_RETRY_COUNT) break;
      await sleep(NETWORK_RETRY_BASE_DELAY_MS * 2 ** attempt, undefined, {
        signal,
      });
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Fetch failed for ${url}`);
};
