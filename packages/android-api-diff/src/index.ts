#!/usr/bin/env node
import process from 'node:process';
import { inspect, parseArgs } from 'node:util';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName,
  toAndroidApiResolution,
  type AndroidApiQueryProgress,
  type AndroidApiQueryRuntime,
} from '@android-cs/api-query';
import { generateAndroidApiCode } from '@android-cs/api-query/code';
import { queryAndroidApi } from '@android-cs/api-query/query';
import packageJson from '../package.json' with { type: 'json' };
import {
  createNodeInstallRuntime,
  installCliAndSkill,
  InstallCommandError,
  type InstallRuntime,
} from './installer.ts';
import { createNodeRuntime, getDefaultCacheDir } from './nodeRuntime.ts';

const QUERY_CONCURRENCY = 5;

export type CliFormat = 'json' | 'pretty';

export type CliRequest =
  | {
      command: 'resolve';
      apiName: string;
      format: CliFormat;
    }
  | {
      command: 'query' | 'generate';
      apiName: string;
      minSdk?: number;
      format: CliFormat;
    }
  | {
      command: 'preload';
      apiNames: string[];
      minSdk?: number;
      format: CliFormat;
    }
  | {
      command: 'install';
      format: CliFormat;
    }
  | {
      command: 'help';
      topic?: string;
    }
  | {
      command: 'version';
    };

interface CliIo {
  stdout: Pick<NodeJS.WriteStream, 'write'> & {
    isTTY?: boolean;
  };
  stderr: Pick<NodeJS.WriteStream, 'write'> & {
    isTTY?: boolean;
  };
}

interface ExecuteContext {
  installRuntime: InstallRuntime;
  runtime: AndroidApiQueryRuntime;
  signal: AbortSignal;
  progress: ReturnType<typeof createProgressReporter>;
}

export interface RunCliOptions {
  io?: CliIo;
  signal?: AbortSignal;
  runtime?: AndroidApiQueryRuntime;
  installRuntime?: InstallRuntime;
  execute?: (
    request: Exclude<CliRequest, { command: 'help' | 'version' }>,
    context: ExecuteContext,
  ) => Promise<unknown>;
}

class CliUsageError extends Error {
  readonly code = 'INVALID_ARGUMENT';
}

const GENERAL_HELP = `android-api-diff

Inspect Android framework APIs across versions and generate hidden-API Java code.

Usage:
  android-api-diff resolve <api-name> [--format json|pretty]
  android-api-diff query <api-name> [--min-sdk <api>] [--format json|pretty]
  android-api-diff generate <api-name> [--min-sdk <api>] [--format json|pretty]
  android-api-diff preload <api-name...> [--min-sdk <api>] [--format json|pretty]
  android-api-diff install [--format json|pretty]

Options:
  --min-sdk <api>       Lowest Android API level to inspect
  --format <format>     Output format: json (default) or pretty
  -h, --help            Show help
  -v, --version         Show version

Examples:
  android-api-diff resolve "ContentObserver()"
  android-api-diff query "IActivityManager.getTasks" --min-sdk 28
  android-api-diff generate "ActivityThread.currentApplication" --min-sdk 28
  android-api-diff preload "ContentObserver()" "IActivityManager.getTasks"
  npx android-api-diff@latest install
`;

const HELP_BY_TOPIC: Record<string, string> = {
  resolve: `Usage: android-api-diff resolve <api-name> [--format json|pretty]

Resolve an Android API name to its frameworks/base source path without
inspecting historical source tags.
`,
  query: `Usage: android-api-diff query <api-name> [--min-sdk <api>] [--format json|pretty]

Inspect cross-version signatures, ranges, missing reasons, and source metadata.
Range endpoints describe the current query snapshot.
`,
  generate: `Usage: android-api-diff generate <api-name> [--min-sdk <api>] [--format json|pretty]

Generate Java hidden-API code. This command performs the version query itself.
`,
  preload: `Usage: android-api-diff preload <api-name...> [--min-sdk <api>] [--format json|pretty]

Preload query results for one or more APIs into the local cache.
`,
  install: `Usage: android-api-diff install [--format json|pretty]

Install or upgrade the global android-api-diff CLI with npm, then install the
matching Codex Skill globally. npm owns CLI version detection and upgrades.
`,
};

const usageError = (message: string): never => {
  throw new CliUsageError(message);
};

const parseMinSdk = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    usageError('--min-sdk must be a positive integer');
  }
  const minSdk = Number(value);
  if (!Number.isSafeInteger(minSdk) || minSdk < 1) {
    usageError('--min-sdk must be a positive integer');
  }
  return minSdk;
};

const parseFormat = (value: string | undefined): CliFormat => {
  if (value === undefined || value === 'json') return 'json';
  if (value === 'pretty') return 'pretty';
  return usageError('--format must be either "json" or "pretty"');
};

const requireApiName = (positionals: string[], expectedCount = 1): string => {
  if (positionals.length < expectedCount + 1) {
    usageError('an API name is required');
  }
  if (positionals.length > expectedCount + 1) {
    usageError('unexpected positional arguments');
  }
  const apiName = positionals.at(-1)?.trim();
  if (!apiName) usageError('an API name is required');
  return apiName!;
};

export const parseCliArgs = (args: string[]): CliRequest => {
  let parsed:
    | {
        values: {
          help?: boolean;
          version?: boolean;
          format?: string;
          'min-sdk'?: string;
        };
        positionals: string[];
      }
    | undefined;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        format: { type: 'string' },
        'min-sdk': { type: 'string' },
      },
    });
  } catch (error) {
    usageError(error instanceof Error ? error.message : String(error));
  }
  if (!parsed) usageError('unable to parse arguments');

  const { values, positionals } = parsed!;
  if (values.version) return { command: 'version' };
  if (values.help || positionals.length === 0) {
    return {
      command: 'help',
      ...(positionals[0] ? { topic: positionals[0] } : {}),
    };
  }

  const command = positionals[0];
  const format = parseFormat(values.format);
  const minSdk = parseMinSdk(values['min-sdk']);

  if (command === 'install') {
    if (positionals.length > 1) {
      usageError('install does not accept positional arguments');
    }
    if (minSdk !== undefined) {
      usageError('install does not accept --min-sdk');
    }
    return {
      command,
      format,
    };
  }

  if (command === 'resolve') {
    if (minSdk !== undefined) {
      usageError('resolve does not accept --min-sdk');
    }
    return {
      command,
      apiName: requireApiName(positionals),
      format,
    };
  }

  if (command === 'query' || command === 'generate') {
    return {
      command,
      apiName: requireApiName(positionals),
      ...(minSdk === undefined ? {} : { minSdk }),
      format,
    };
  }

  if (command === 'preload') {
    const apiNames = positionals.slice(1).map((value) => value.trim());
    if (apiNames.length === 0 || apiNames.some((value) => !value)) {
      usageError('preload requires at least one API name');
    }
    return {
      command,
      apiNames,
      ...(minSdk === undefined ? {} : { minSdk }),
      format,
    };
  }

  return usageError(`unknown command: ${command}`);
};

const toProgressMessage = (
  apiName: string,
  progress: AndroidApiQueryProgress,
): string => {
  if (progress.currentTag) {
    return `${apiName}: ${progress.completedTags}/${progress.totalTags} (${progress.currentTag})`;
  }
  return `${apiName}: checking ${progress.totalTags} Android tags`;
};

const createProgressReporter = (
  stderr: CliIo['stderr'],
): {
  update(message: string): void;
  finish(message?: string): void;
} => {
  let previousLength = 0;
  const enabled = stderr.isTTY === true;
  return {
    update(message) {
      if (!enabled) return;
      const padded = message.padEnd(previousLength);
      previousLength = message.length;
      stderr.write(`\r${padded}`);
    },
    finish(message) {
      if (!enabled) return;
      if (message) {
        const padded = message.padEnd(previousLength);
        stderr.write(`\r${padded}\n`);
      } else if (previousLength > 0) {
        stderr.write('\n');
      }
      previousLength = 0;
    },
  };
};

const executeRequest = async (
  request: Exclude<CliRequest, { command: 'help' | 'version' }>,
  { installRuntime, runtime, signal, progress }: ExecuteContext,
): Promise<unknown> => {
  if (request.command === 'install') {
    return installCliAndSkill(installRuntime, packageJson.version, signal);
  }

  if (request.command === 'resolve') {
    progress.update(`${request.apiName}: resolving`);
    const aidlJavaFiles = await loadAidlJavaFiles(runtime, signal);
    const result = {
      apiName: request.apiName,
      result:
        toAndroidApiResolution(
          searchFilePathByRefName(request.apiName, aidlJavaFiles),
        ) ?? null,
    };
    progress.finish(`${request.apiName}: resolved`);
    return result;
  }

  if (request.command === 'query' || request.command === 'generate') {
    progress.update(`${request.apiName}: resolving and checking cache`);
    const options = {
      apiName: request.apiName,
      concurrency: QUERY_CONCURRENCY,
      ...(request.minSdk === undefined ? {} : { minSdk: request.minSdk }),
      signal,
      onProgress: (update: AndroidApiQueryProgress) => {
        progress.update(toProgressMessage(request.apiName, update));
      },
    };
    const result =
      request.command === 'query'
        ? await queryAndroidApi(runtime, options)
        : await generateAndroidApiCode(runtime, options);
    progress.finish(`${request.apiName}: ${request.command} complete`);
    return result;
  }

  if (request.command !== 'preload') {
    throw new Error(`Unsupported command: ${request.command}`);
  }
  const results = [];
  for (const [index, apiName] of request.apiNames.entries()) {
    progress.update(
      `${apiName}: preparing ${index + 1}/${request.apiNames.length}`,
    );
    const result = await queryAndroidApi(runtime, {
      apiName,
      concurrency: QUERY_CONCURRENCY,
      ...(request.minSdk === undefined ? {} : { minSdk: request.minSdk }),
      signal,
      onProgress: (update) => {
        progress.update(
          `[${index + 1}/${request.apiNames.length}] ${toProgressMessage(apiName, update)}`,
        );
      },
    });
    results.push({
      apiName,
      checkedTags: result.summary.checkedTags,
      foundTags: result.summary.foundTags,
      rangeCount: result.summary.rangeCount,
    });
  }
  progress.finish(`Cache ready for ${request.apiNames.length} Android APIs`);
  return {
    cacheDir: getDefaultCacheDir(),
    results,
  };
};

const writeSuccess = (
  request: Exclude<CliRequest, { command: 'help' | 'version' }>,
  result: unknown,
  io: CliIo,
) => {
  const response = {
    ok: true,
    command: request.command,
    result,
  };
  const output =
    request.format === 'json'
      ? JSON.stringify(response)
      : inspect(response, {
          colors: io.stdout.isTTY === true,
          depth: null,
          maxArrayLength: null,
          breakLength: 100,
          compact: false,
        });
  io.stdout.write(`${output}\n`);
};

const getErrorCode = (error: unknown): string => {
  if (error instanceof CliUsageError) return error.code;
  if (error instanceof InstallCommandError) return error.code;
  const visited = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const candidate = current as {
      code?: unknown;
      name?: unknown;
      cause?: unknown;
    };
    if (
      typeof candidate.code === 'string' &&
      [
        'ENOTFOUND',
        'EAI_AGAIN',
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
      ].includes(candidate.code)
    ) {
      return 'NETWORK_ERROR';
    }
    if (candidate.name === 'AbortError' || candidate.code === 'ABORT_ERR') {
      return 'ABORTED';
    }
    current = candidate.cause;
  }
  return 'INTERNAL_ERROR';
};

const writeError = (error: unknown, io: CliIo): string => {
  const code = getErrorCode(error);
  const message =
    code === 'ABORTED'
      ? 'Command cancelled'
      : error instanceof Error
        ? error.message
        : String(error);
  io.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: {
        code,
        message,
      },
    })}\n`,
  );
  return code;
};

const getHelp = (topic: string | undefined): string => {
  return (topic && HELP_BY_TOPIC[topic]) || GENERAL_HELP;
};

export const runCli = async (
  args: string[],
  options: RunCliOptions = {},
): Promise<number> => {
  const io: CliIo = options.io ?? {
    stdout: process.stdout,
    stderr: process.stderr,
  };
  let progress: ReturnType<typeof createProgressReporter> | undefined;
  try {
    const request = parseCliArgs(args);
    if (request.command === 'help') {
      io.stdout.write(getHelp(request.topic));
      return 0;
    }
    if (request.command === 'version') {
      io.stdout.write(`${packageJson.version}\n`);
      return 0;
    }

    const signal = options.signal ?? new AbortController().signal;
    signal.throwIfAborted();
    progress = createProgressReporter(io.stderr);
    const result = await (options.execute ?? executeRequest)(request, {
      installRuntime:
        options.installRuntime ?? createNodeInstallRuntime(io.stderr),
      runtime: options.runtime ?? createNodeRuntime(),
      signal,
      progress,
    });
    signal.throwIfAborted();
    writeSuccess(request, result, io);
    return 0;
  } catch (error) {
    progress?.finish();
    const code = writeError(error, io);
    return code === 'ABORTED' ? 130 : code === 'INVALID_ARGUMENT' ? 2 : 1;
  }
};

export const main = async (args = process.argv.slice(2)): Promise<number> => {
  const controller = new AbortController();
  const onSigint = () => controller.abort();
  process.once('SIGINT', onSigint);
  try {
    return await runCli(args, { signal: controller.signal });
  } finally {
    process.off('SIGINT', onSigint);
  }
};

if (import.meta.main) {
  process.exitCode = await main();
}
