#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { loadAidlJavaFiles, searchFilePathByRefName } from '@android-cs/api-query';
import { queryAndroidApi } from '@android-cs/api-query/query';
import { z } from 'zod';
import { createNodeRuntime, getDefaultCacheDir } from './nodeRuntime.ts';

const runtime = createNodeRuntime();

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
  version: '0.0.0',
});

server.registerTool(
  'query_android_api',
  {
    title: 'Query Android API',
    description:
      'Resolve an Android Java/AIDL API name and return cross-version declarations, signatures, and source links.',
    inputSchema: z.object({
      apiName: z
        .string()
        .min(1)
        .describe(
          'API name, such as IActivityManager.getTasks, ActivityThread#currentApplication, or android.app.IActivityManager.',
      ),
      minSdk: z.number().int().optional(),
      maxSdk: z.number().int().optional(),
      tagStrategy: z.enum(['latest-per-version', 'all']).optional(),
    }),
  },
  async ({ apiName, minSdk, maxSdk, tagStrategy }) => {
    return toJsonText(
      await queryAndroidApi(runtime, {
        apiName,
        minSdk,
        maxSdk,
        tagStrategy,
      }),
    );
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
      result: searchFilePathByRefName(apiName, aidlJavaFiles),
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
      maxSdk: z.number().int().optional(),
      tagStrategy: z.enum(['latest-per-version', 'all']).optional(),
    }),
  },
  async ({ apiNames, minSdk, maxSdk, tagStrategy }) => {
    const results = [];
    for (const apiName of apiNames) {
      const result = await queryAndroidApi(runtime, {
        apiName,
        minSdk,
        maxSdk,
        tagStrategy,
      });
      results.push({
        apiName,
        checkedTags: result.summary.checkedTags,
        foundTags: result.summary.foundTags,
      });
    }
    return toJsonText({
      cacheDir: getDefaultCacheDir(),
      results,
    });
  },
);

await server.connect(new StdioServerTransport());
