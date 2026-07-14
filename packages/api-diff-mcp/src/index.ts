#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName,
  toAndroidApiResolution,
} from '@android-cs/api-query';
import { generateAndroidApiCode } from '@android-cs/api-query/code';
import { queryAndroidApi } from '@android-cs/api-query/query';
import { z } from 'zod';
import packageJson from '../package.json' with { type: 'json' };
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
  async ({ apiName, minSdk }) => {
    return toJsonText(
      await generateAndroidApiCode(runtime, {
        apiName,
        minSdk,
      }),
    );
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
  async ({ apiName, minSdk }) => {
    return toJsonText(
      await queryAndroidApi(runtime, {
        apiName,
        minSdk,
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
  async ({ apiNames, minSdk }) => {
    const results = [];
    for (const apiName of apiNames) {
      const result = await queryAndroidApi(runtime, {
        apiName,
        minSdk,
      });
      results.push({
        apiName,
        checkedTags: result.summary.checkedTags,
        foundTags: result.summary.foundTags,
        rangeCount: result.summary.rangeCount,
      });
    }
    return toJsonText({
      cacheDir: getDefaultCacheDir(),
      results,
    });
  },
);

await server.connect(new StdioServerTransport());
