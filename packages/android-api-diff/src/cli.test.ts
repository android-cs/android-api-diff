import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };
import { parseCliArgs, runCli, type RunCliOptions } from './index.ts';
import {
  findProjectRoot,
  getSkillSource,
  skillRemovalOutputReportsFailure,
} from './installer.ts';

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
  assert.throws(() => parseCliArgs(['install']), /unknown command: install/);
  assert.throws(
    () => parseCliArgs(['skill', 'install', '--skill-scope', 'workspace']),
    /--skill-scope must be either "project" or "global"/,
  );
  assert.throws(
    () =>
      parseCliArgs([
        'query',
        'IActivityManager.getTasks',
        '--skill-scope',
        'global',
      ]),
    /--skill-scope is only supported by skill commands/,
  );
  assert.deepEqual(parseCliArgs(['skill']), {
    command: 'help',
    topic: 'skill',
  });
  assert.deepEqual(parseCliArgs(['skill', 'install']), {
    action: 'install',
    command: 'skill',
    format: 'json',
    skillScope: 'project',
  });
  assert.deepEqual(
    parseCliArgs([
      'skill',
      'remove',
      '--skill-scope',
      'global',
      '--format',
      'pretty',
    ]),
    {
      action: 'remove',
      command: 'skill',
      format: 'pretty',
      skillScope: 'global',
    },
  );
  assert.throws(
    () => parseCliArgs(['skill', 'update']),
    /skill action must be either "install" or "remove"/,
  );
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

test('finds the nearest Git or Gradle project root', async (context) => {
  const gitRoot = await mkdtemp(join(tmpdir(), 'android-api-diff-'));
  const gradleRoot = await mkdtemp(join(tmpdir(), 'android-api-diff-'));
  context.after(() =>
    Promise.all([
      rm(gitRoot, { recursive: true, force: true }),
      rm(gradleRoot, { recursive: true, force: true }),
    ]),
  );
  const gitNested = join(gitRoot, 'app', 'src');
  const gradleNested = join(gradleRoot, 'app');
  await mkdir(join(gitRoot, '.git'));
  await mkdir(gitNested, { recursive: true });
  await mkdir(gradleNested);
  await writeFile(join(gradleRoot, 'settings.gradle.kts'), '');

  assert.equal(findProjectRoot(gitNested), gitRoot);
  assert.equal(findProjectRoot(gradleNested), gradleRoot);
});

test('recognizes incomplete upstream Skill removal output', () => {
  assert.equal(
    skillRemovalOutputReportsFailure(
      'Could not remove skill from Codex: access denied',
    ),
    true,
  );
  assert.equal(
    skillRemovalOutputReportsFailure('Failed to remove 1 skill(s)'),
    true,
  );
  assert.equal(
    skillRemovalOutputReportsFailure('Successfully removed 1 skill(s)'),
    false,
  );
});

test('skill install changes only the project Skill', async () => {
  const output = createOutput();
  const calls: {
    args: readonly string[];
    command: string;
    cwd?: string;
  }[] = [];
  const exitCode = await runCli(['skill', 'install'], {
    io: output.io,
    installRuntime: {
      async run(command, args, _signal, options) {
        calls.push({
          command,
          args,
          ...(options?.cwd ? { cwd: options.cwd } : {}),
        });
      },
    },
  });

  const projectRoot = findProjectRoot(process.cwd());
  assert.ok(projectRoot);
  const skillSource = getSkillSource(packageJson.version);
  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      command: 'skills',
      args: ['add', skillSource, '--agent', 'codex', '--yes'],
      cwd: projectRoot,
    },
  ]);
  assert.deepEqual(JSON.parse(output.stdout), {
    ok: true,
    command: 'skill',
    action: 'install',
    result: {
      skill: {
        agent: 'codex',
        name: 'android-api-diff',
        path: join(projectRoot, '.agents', 'skills', 'android-api-diff'),
        scope: 'project',
        source: skillSource,
      },
    },
  });
});

test('skill remove targets only the project Codex Skill', async () => {
  const output = createOutput();
  const calls: {
    args: readonly string[];
    command: string;
    cwd?: string;
  }[] = [];
  const exitCode = await runCli(['skill', 'remove'], {
    io: output.io,
    installRuntime: {
      pathExists() {
        return false;
      },
      readTextFile() {
        return undefined;
      },
      async run(command, args, _signal, options) {
        calls.push({
          command,
          args,
          ...(options?.cwd ? { cwd: options.cwd } : {}),
        });
      },
    },
  });

  const projectRoot = findProjectRoot(process.cwd());
  assert.ok(projectRoot);
  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      command: 'skills',
      args: ['remove', 'android-api-diff', '--agent', 'codex', '--yes'],
      cwd: projectRoot,
    },
  ]);
  assert.deepEqual(JSON.parse(output.stdout), {
    ok: true,
    command: 'skill',
    action: 'remove',
    result: {
      skill: {
        name: 'android-api-diff',
        path: join(projectRoot, '.agents', 'skills', 'android-api-diff'),
        scope: 'project',
      },
    },
  });
});

test('skill remove cleans a canonical path retained for another agent', async () => {
  const output = createOutput();
  const projectRoot = findProjectRoot(process.cwd());
  assert.ok(projectRoot);
  const skillPath = join(projectRoot, '.agents', 'skills', 'android-api-diff');
  const remainingPaths = new Set([skillPath]);
  const removedPaths: string[] = [];

  const exitCode = await runCli(['skill', 'remove'], {
    io: output.io,
    installRuntime: {
      pathExists(path) {
        return remainingPaths.has(path);
      },
      readTextFile() {
        return undefined;
      },
      removePath(path) {
        removedPaths.push(path);
        remainingPaths.delete(path);
      },
      async run() {},
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(removedPaths, [skillPath]);
  assert.equal(remainingPaths.size, 0);
  assert.deepEqual(JSON.parse(output.stdout).result.skill, {
    name: 'android-api-diff',
    path: skillPath,
    scope: 'project',
  });
});

test('skill remove supports global cleanup without a project directory', async () => {
  const output = createOutput();
  const calls: {
    args: readonly string[];
    command: string;
    cwd?: string;
  }[] = [];
  const exitCode = await runCli(
    ['skill', 'remove', '--skill-scope', 'global'],
    {
      cwd: join(tmpdir(), 'not-a-project'),
      io: output.io,
      installRuntime: {
        pathExists() {
          return false;
        },
        readTextFile() {
          return undefined;
        },
        async run(command, args, _signal, options) {
          calls.push({
            command,
            args,
            ...(options?.cwd ? { cwd: options.cwd } : {}),
          });
        },
      },
    },
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(calls, [
    {
      command: 'skills',
      args: [
        'remove',
        'android-api-diff',
        '--agent',
        'codex',
        '--global',
        '--yes',
      ],
      cwd: homedir(),
    },
  ]);
  assert.deepEqual(JSON.parse(output.stdout).result.skill, {
    name: 'android-api-diff',
    path: join(homedir(), '.agents', 'skills', 'android-api-diff'),
    scope: 'global',
  });
});

test('project Skill subcommands fail before mutation when no project is found', async (context) => {
  const cwd = await mkdtemp(join(tmpdir(), 'android-api-diff-'));
  context.after(() => rm(cwd, { recursive: true, force: true }));

  for (const action of ['install', 'remove'] as const) {
    const output = createOutput();
    let callCount = 0;
    const exitCode = await runCli(['skill', action], {
      cwd,
      io: output.io,
      installRuntime: {
        async run() {
          callCount += 1;
        },
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(callCount, 0);
    assert.equal(output.stdout, '');
    assert.match(
      JSON.parse(output.stderr).error.message,
      /requires a Git or Gradle project/,
    );
  }
});

test('skill install reports an exact retry command', async () => {
  const output = createOutput();
  let callCount = 0;
  const exitCode = await runCli(['skill', 'install'], {
    io: output.io,
    installRuntime: {
      async run() {
        callCount += 1;
        throw new Error('skills installer unavailable');
      },
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(callCount, 1);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  const projectRoot = findProjectRoot(process.cwd());
  assert.ok(projectRoot);
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.match(response.error.message, /The Skill installation failed/);
  assert.ok(response.error.message.includes(projectRoot));
  assert.match(response.error.message, /android-api-diff skill install/);
  assert.doesNotMatch(response.error.message, /--global/);
});

test('skill remove reports an exact retry command', async () => {
  const output = createOutput();
  const exitCode = await runCli(['skill', 'remove'], {
    io: output.io,
    installRuntime: {
      async run() {
        throw new Error('skills remover unavailable');
      },
    },
  });

  const projectRoot = findProjectRoot(process.cwd());
  assert.ok(projectRoot);
  assert.equal(exitCode, 1);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.match(response.error.message, /The Skill removal failed/);
  assert.ok(response.error.message.includes(projectRoot));
  assert.match(response.error.message, /android-api-diff skill remove/);
  assert.doesNotMatch(response.error.message, /--agent/);
});

test('skill remove rejects a false-success when the Skill path remains', async () => {
  const output = createOutput();
  const exitCode = await runCli(['skill', 'remove'], {
    io: output.io,
    installRuntime: {
      pathExists() {
        return true;
      },
      readTextFile() {
        return undefined;
      },
      async run() {},
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.match(response.error.message, /command completed/);
  assert.match(response.error.message, /still exist/);
});

test('global Skill removal verifies the Codex-native path', async () => {
  const output = createOutput();
  const codexPath = join(homedir(), '.codex', 'skills', 'android-api-diff');
  const exitCode = await runCli(
    ['skill', 'remove', '--skill-scope', 'global'],
    {
      io: output.io,
      installRuntime: {
        pathExists(path) {
          return path === codexPath;
        },
        readTextFile() {
          return undefined;
        },
        async run() {},
      },
    },
  );

  assert.equal(exitCode, 1);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.ok(response.error.message.includes(codexPath));
});

test('Skill removal rejects a dangling Codex path', async (context) => {
  const output = createOutput();
  const projectRoot = await mkdtemp(join(tmpdir(), 'android-api-diff-'));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  await mkdir(join(projectRoot, '.git'));
  const skillPath = join(projectRoot, '.agents', 'skills', 'android-api-diff');
  await mkdir(join(projectRoot, '.agents', 'skills'), { recursive: true });
  await symlink(
    join(projectRoot, 'missing-skill-target'),
    skillPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const exitCode = await runCli(['skill', 'remove'], {
    cwd: projectRoot,
    io: output.io,
    installRuntime: {
      readTextFile() {
        return undefined;
      },
      async run() {},
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.ok(response.error.message.includes(skillPath));
  assert.match(response.error.message, /symbolic link or junction/);
});

test('project Skill management rejects symlinked writable paths', async (context) => {
  for (const entry of ['.agents', 'skills-lock.json']) {
    const output = createOutput();
    const projectRoot = await mkdtemp(join(tmpdir(), 'android-api-diff-'));
    const externalRoot = await mkdtemp(join(tmpdir(), 'android-api-diff-'));
    context.after(() =>
      Promise.all([
        rm(projectRoot, { recursive: true, force: true }),
        rm(externalRoot, { recursive: true, force: true }),
      ]),
    );
    await mkdir(join(projectRoot, '.git'));
    const linkedPath = join(projectRoot, entry);
    await symlink(
      externalRoot,
      linkedPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    let callCount = 0;

    const exitCode = await runCli(['skill', 'install'], {
      cwd: projectRoot,
      io: output.io,
      installRuntime: {
        async run() {
          callCount += 1;
        },
      },
    });

    assert.equal(exitCode, 1);
    assert.equal(callCount, 0);
    assert.equal(output.stdout, '');
    const response = JSON.parse(output.stderr);
    assert.equal(response.error.code, 'INSTALL_FAILED');
    assert.ok(response.error.message.includes(linkedPath));
    assert.match(response.error.message, /symbolic link or junction/);
  }
});

test('Skill removal rejects a stale lock entry', async () => {
  const output = createOutput();
  const projectRoot = findProjectRoot(process.cwd());
  assert.ok(projectRoot);
  const lockPath = join(projectRoot, 'skills-lock.json');
  const exitCode = await runCli(['skill', 'remove'], {
    io: output.io,
    installRuntime: {
      pathExists() {
        return false;
      },
      readTextFile(path) {
        assert.equal(path, lockPath);
        return JSON.stringify({
          version: 1,
          skills: {
            'android-api-diff': {},
          },
        });
      },
      async run() {},
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output.stdout, '');
  const response = JSON.parse(output.stderr);
  assert.equal(response.error.code, 'INSTALL_FAILED');
  assert.ok(response.error.message.includes(lockPath));
  assert.match(response.error.message, /still tracks android-api-diff/);
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
