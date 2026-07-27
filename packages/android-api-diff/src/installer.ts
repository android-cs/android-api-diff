import { spawn } from 'node:child_process';
import process from 'node:process';

const CLI_PACKAGE = 'android-api-diff@latest';
const SKILL_NAME = 'android-api-diff';
const SKILL_REPOSITORY = 'android-cs/android-api-diff';

type PackageManager = 'npm' | 'npx';

export interface InstallRuntime {
  run(
    command: PackageManager,
    args: readonly string[],
    signal: AbortSignal,
  ): Promise<void>;
}

export interface InstallResult {
  cli: {
    package: string;
    scope: 'global';
  };
  skill: {
    agent: 'codex';
    name: string;
    scope: 'global';
    source: string;
  };
}

export class InstallCommandError extends Error {
  readonly code = 'INSTALL_FAILED';
}

const executableFor = (command: PackageManager): string => {
  return process.platform === 'win32' ? `${command}.cmd` : command;
};

export const getSkillSource = (version: string): string => {
  return `https://github.com/${SKILL_REPOSITORY}/tree/v${version}/skills/${SKILL_NAME}`;
};

export const createNodeInstallRuntime = (
  stderr: Pick<NodeJS.WriteStream, 'write'>,
): InstallRuntime => ({
  run(command, args, signal) {
    return new Promise((resolve, reject) => {
      const child = spawn(executableFor(command), [...args], {
        signal,
        stdio: ['inherit', 'pipe', 'pipe'],
        windowsHide: true,
      });

      child.stdout.on('data', (chunk: Buffer) => {
        stderr.write(chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr.write(chunk);
      });
      child.once('error', (error) => {
        reject(error);
      });
      child.once('close', (code, childSignal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new InstallCommandError(
            childSignal
              ? `${command} was terminated by ${childSignal}`
              : `${command} exited with code ${code ?? 'unknown'}`,
          ),
        );
      });
    });
  },
});

export const installCliAndSkill = async (
  runtime: InstallRuntime,
  version: string,
  signal: AbortSignal,
): Promise<InstallResult> => {
  try {
    await runtime.run('npm', ['install', '--global', CLI_PACKAGE], signal);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new InstallCommandError(`Unable to install ${CLI_PACKAGE} globally`, {
      cause: error,
    });
  }

  const skillSource = getSkillSource(version);
  try {
    await runtime.run(
      'npx',
      [
        '--yes',
        'skills',
        'add',
        skillSource,
        '--agent',
        'codex',
        '--global',
        '--yes',
      ],
      signal,
    );
  } catch (error) {
    if (signal.aborted) throw error;
    throw new InstallCommandError(
      `The CLI was installed, but the Skill installation failed. Retry with: npx --yes skills add ${skillSource} --agent codex --global --yes`,
      { cause: error },
    );
  }

  return {
    cli: {
      package: CLI_PACKAGE,
      scope: 'global',
    },
    skill: {
      agent: 'codex',
      name: SKILL_NAME,
      scope: 'global',
      source: skillSource,
    },
  };
};
