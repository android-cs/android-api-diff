#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName,
  toAndroidApiResolution,
  type AndroidApiQueryProgress,
} from '@android-cs/api-query';
import { generateAndroidApiCode } from '@android-cs/api-query/code';
import { queryAndroidApi } from '@android-cs/api-query/query';
import { z } from 'zod';
import packageJson from '../package.json' with { type: 'json' };
import { createNodeRuntime, getDefaultCacheDir } from './nodeRuntime.ts';

const runtime = createNodeRuntime();
const PROGRESS_NOTIFICATION_INTERVAL_MS = 1_000;
const MCP_QUERY_CONCURRENCY = 5;

interface McpProgressUpdate extends Record<string, unknown> {
  progress: number;
  total?: number;
  message?: string;
}

interface McpProgressNotification {
  method: 'notifications/progress';
  params: McpProgressUpdate & {
    progressToken: string | number;
  };
}

const createProgressReporter = (
  progressToken: string | number | undefined,
  notify: (notification: McpProgressNotification) => Promise<void>,
) => {
  let lastProgress = Number.NEGATIVE_INFINITY;
  let lastNotificationAt = Number.NEGATIVE_INFINITY;
  let pending = Promise.resolve();

  const report = (update: McpProgressUpdate): Promise<void> => {
    if (progressToken === undefined || update.progress <= lastProgress) {
      return pending;
    }
    const now = Date.now();
    const isInitial = update.progress === 0;
    const isFinal =
      update.total !== undefined && update.progress >= update.total;
    if (
      !isInitial &&
      !isFinal &&
      now - lastNotificationAt < PROGRESS_NOTIFICATION_INTERVAL_MS
    ) {
      return pending;
    }

    lastProgress = update.progress;
    lastNotificationAt = now;
    pending = pending.then(() =>
      notify({
        method: 'notifications/progress',
        params: {
          progressToken,
          ...update,
        },
      }),
    );
    return pending;
  };

  return {
    report,
    flush: () => pending,
  };
};

const toMcpQueryProgress = (
  apiName: string,
  progress: AndroidApiQueryProgress,
): McpProgressUpdate => {
  return {
    progress: progress.completedTags,
    total: progress.totalTags,
    message: progress.currentTag
      ? `${apiName}: checked ${progress.currentTag} (${progress.completedTags}/${progress.totalTags})`
      : `${apiName}: checking ${progress.totalTags} Android tags`,
  };
};

const toJsonText = (value: unknown) => {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
};

const server = new McpServer({
  name: 'android-api-diff',
  version: packageJson.version,
});

server.registerTool(
  'generate_android_api_code',
  {
    title: 'Generate Android API Code',
    description:
      'Generate Java code for a hidden Android member API. This tool performs the cross-version query internally; do not call query_android_api first.',
    inputSchema: z.object({
      apiName: z
        .string()
        .min(1)
        .describe(
          'Member API name, such as IActivityManager.getTasks or ActivityThread.currentApplication.',
        ),
      minSdk: z.number().int().optional(),
    }),
  },
  async ({ apiName, minSdk }, ctx) => {
    const progress = createProgressReporter(
      ctx.mcpReq._meta?.progressToken,
      (notification) => ctx.mcpReq.notify(notification),
    );
    await progress.report({
      progress: 0,
      message: `${apiName}: resolving API and checking cache`,
    });
    const result = await generateAndroidApiCode(runtime, {
      apiName,
      concurrency: MCP_QUERY_CONCURRENCY,
      minSdk,
      signal: ctx.mcpReq.signal,
      onProgress: (update) =>
        progress.report(toMcpQueryProgress(apiName, update)),
    });
    const checkedTags = Math.max(result.summary.checkedTags, 1);
    await progress.report({
      progress: checkedTags,
      total: checkedTags,
      message: `${apiName}: generation complete`,
    });
    await progress.flush();
    return toJsonText(result);
  },
);

server.registerTool(
  'query_android_api',
  {
    title: 'Inspect Android API Versions',
    description:
      'Inspect exact cross-version signatures, tag ranges, missing reasons, and source metadata for an Android Java/AIDL API. Use generate_android_api_code instead when Java hidden-API code is needed. Endpoint positions are relative to the current query snapshot; last-checked does not mean permanently final.',
    inputSchema: z.object({
      apiName: z
        .string()
        .min(1)
        .describe(
          'API name, such as IActivityManager.getTasks, ActivityThread#currentApplication, or android.app.IActivityManager.',
        ),
      minSdk: z.number().int().optional(),
    }),
  },
  async ({ apiName, minSdk }, ctx) => {
    const progress = createProgressReporter(
      ctx.mcpReq._meta?.progressToken,
      (notification) => ctx.mcpReq.notify(notification),
    );
    await progress.report({
      progress: 0,
      message: `${apiName}: resolving API and checking cache`,
    });
    const result = await queryAndroidApi(runtime, {
      apiName,
      concurrency: MCP_QUERY_CONCURRENCY,
      minSdk,
      signal: ctx.mcpReq.signal,
      onProgress: (update) =>
        progress.report(toMcpQueryProgress(apiName, update)),
    });
    const checkedTags = Math.max(result.summary.checkedTags, 1);
    await progress.report({
      progress: checkedTags,
      total: checkedTags,
      message: `${apiName}: query complete`,
    });
    await progress.flush();
    return toJsonText(result);
  },
);

server.registerTool(
  'resolve_android_api',
  {
    title: 'Resolve Android API Name',
    description:
      'Resolve an Android API name to the frameworks/base file, target path, and target kind without fetching source versions.',
    inputSchema: z.object({
      apiName: z.string().min(1),
    }),
  },
  async ({ apiName }) => {
    const aidlJavaFiles = await loadAidlJavaFiles(runtime);
    return toJsonText({
      apiName,
      result: toAndroidApiResolution(
        searchFilePathByRefName(apiName, aidlJavaFiles),
      ),
    });
  },
);

server.registerTool(
  'warm_android_api_cache',
  {
    title: 'Warm Android API Cache',
    description:
      'Preload query cache for a list of Android API names so later AI calls are faster.',
    inputSchema: z.object({
      apiNames: z.array(z.string().min(1)).min(1),
      minSdk: z.number().int().optional(),
    }),
  },
  async ({ apiNames, minSdk }, ctx) => {
    const progress = createProgressReporter(
      ctx.mcpReq._meta?.progressToken,
      (notification) => ctx.mcpReq.notify(notification),
    );
    await progress.report({
      progress: 0,
      total: apiNames.length,
      message: `Preparing to cache ${apiNames.length} Android APIs`,
    });
    const results = [];
    for (const [index, apiName] of apiNames.entries()) {
      const result = await queryAndroidApi(runtime, {
        apiName,
        concurrency: MCP_QUERY_CONCURRENCY,
        minSdk,
        signal: ctx.mcpReq.signal,
        onProgress: (update) => {
          const fraction =
            update.totalTags === 0
              ? 0
              : update.completedTags / update.totalTags;
          return progress.report({
            progress: index + fraction,
            total: apiNames.length,
            message: update.currentTag
              ? `${apiName}: checked ${update.currentTag} (${update.completedTags}/${update.totalTags})`
              : `${apiName}: checking ${update.totalTags} Android tags`,
          });
        },
      });
      results.push({
        apiName,
        checkedTags: result.summary.checkedTags,
        foundTags: result.summary.foundTags,
        rangeCount: result.summary.rangeCount,
      });
      await progress.report({
        progress: index + 1,
        total: apiNames.length,
        message: `${apiName}: cache ready`,
      });
    }
    await progress.flush();
    return toJsonText({
      cacheDir: getDefaultCacheDir(),
      results,
    });
  },
);

await server.connect(new StdioServerTransport());
