import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };
import { parseCliArgs, runCli, type RunCliOptions } from './index.ts';
import { getSkillSource } from './installer.ts';

const createOutput = () => {
  let stdout = '';
  let stderr = '';
  const io = {
    stdout: {
      isTTY: false,
      write(chunk: string | Uint8Array) {
        stdout += chunk.toString();
        return true;
      },
    },
    stderr: {
      isTTY: false,
      write(chunk: string | Uint8Array) {
        stderr += chunk.toString();
        return true;
      },
    },
  };
  return {
    io,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
};

test('parses public commands and options', () => {
  assert.deepEqual(parseCliArgs(['install']), {
    command: 'install',
    format: 'json',
  });
  assert.deepEqual(
    parseCliArgs(['query', 'IActivityManager.getTasks', '--min-sdk', '28']),
    {
      command: 'query',
      apiName: 'IActivityManager.getTasks',
      minSdk: 28,
      format: 'json',
    },
  );
  assert.deepEqual(
    parseCliArgs([
      'preload',
      'ContentObserver()',
      'ActivityThread.currentApplication',
      '--format',
      'pretty',
    ]),
    {
      command: 'preload',
      apiNames: ['ContentObserver()', 'ActivityThread.currentApplication'],
      format: 'pretty',
    },
  );
});

test('rejects the unpublished cache warm command instead of keeping an alias', () => {
  assert.throws(
    () => parseCliArgs(['cache', 'warm', 'ContentObserver()']),
    /unknown command: cache/,
  );
});

test('install delegates version handling to npm and installs the matching global Skill', async () => {
  const output = createOutput();
  const calls: { args: readonly string[]; command: string }[] = [];
  const exitCode = await runCli(['install'], {
    io: output.io,
    installRuntime: {
      async run(command, args) {
        calls.push({ command, args });
      },
    },
  });

  const skillSource = getSkillSource(packageJson.version);
  assert.equal(exitCode, 0);
  assert.equal(output.stderr, '');
  assert.deepEqual(calls, [
    {
      command: 'npm',
      args: ['install', '--global', 'android-api-diff@latest'],
    },
    {
      command: 'npx',
      args: [
        '--yes',
        'skills',
        'add',
        skillSource,
        '--agent',
        'codex',
        '--global',
        '--yes',
      ],
    },
  ]);
  assert.deepEqual(JSON.parse(output.stdout), {
    ok: true,
    command: 'install',
    result: {
      cli: {
        package: 'android-api-diff@latest',
        scope: 'global',
      },
      skill: {
        agent: 'codex',
        name: 'android-api-diff',
        scope: 'global',
        source: skillSource,
      },
    },
  });
});

test('install reports a partial failure with a retry command', async () => {
  const output = createOutput();
  let callCount = 0;
  const exitCode = await runCli(['install'], {
    io: output.io,
    installRuntime: {
      async run() {
        callCount += 1;
        if (callCount === 2) {
          throw new Error('skills installer unavailable');
        }
      },
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(callCount, 2);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.match(response.error.message, /The CLI was installed/);
  assert.match(response.error.message, /npx --yes skills add/);
});

test('writes successful JSON only to stdout', async () => {
  const output = createOutput();
  const execute: NonNullable<RunCliOptions['execute']> = async (request) => {
    assert.equal(request.command, 'resolve');
    if (request.command !== 'resolve') throw new Error('unexpected command');
    return {
      apiName: request.apiName,
    };
  };
  const exitCode = await runCli(['resolve', 'ContentObserver()'], {
    io: output.io,
    execute,
  });

  assert.equal(exitCode, 0);
  assert.equal(output.stderr, '');
  assert.deepEqual(JSON.parse(output.stdout), {
    ok: true,
    command: 'resolve',
    result: {
      apiName: 'ContentObserver()',
    },
  });
});

test('resolve keeps an unresolved result explicit and machine-readable', async () => {
  const output = createOutput();
  const exitCode = await runCli(['resolve', 'DefinitelyMissingApi'], {
    io: output.io,
    runtime: {
      fetchText: async () => {
        throw new Error('unexpected fetch');
      },
      loadAidlJavaFiles: async () => [],
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(output.stderr, '');
  assert.deepEqual(JSON.parse(output.stdout), {
    ok: true,
    command: 'resolve',
    result: {
      apiName: 'DefinitelyMissingApi',
      result: null,
    },
  });
});

test('reports invalid arguments as structured stderr', async () => {
  const output = createOutput();
  const exitCode = await runCli(['query'], { io: output.io });

  assert.equal(exitCode, 2);
  assert.equal(output.stdout, '');
  assert.deepEqual(JSON.parse(output.stderr), {
    ok: false,
    error: {
      code: 'INVALID_ARGUMENT',
      message: 'an API name is required',
    },
  });
});

test('reports nested network error codes', async () => {
  const output = createOutput();
  const exitCode = await runCli(['query', 'ContentObserver()'], {
    io: output.io,
    execute: async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('DNS unavailable'), {
          code: 'ENOTFOUND',
        }),
      });
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output.stdout, '');
  assert.equal(JSON.parse(output.stderr).error.code, 'NETWORK_ERROR');
});

test('entrypoint help and version have clean process behavior', () => {
  const entrypoint = fileURLToPath(new URL('./index.ts', import.meta.url));
  const help = spawnSync(process.execPath, [entrypoint, '--help'], {
    encoding: 'utf8',
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^android-api-diff/);
  assert.equal(help.stderr, '');

  const version = spawnSync(process.execPath, [entrypoint, '--version'], {
    encoding: 'utf8',
  });
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(version.stderr, '');
});
