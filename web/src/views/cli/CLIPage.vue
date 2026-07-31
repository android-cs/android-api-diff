<script setup lang="ts">
import { persistentFetch } from '@/utils/cache';
import androidVersionList from '@/utils/android.data';
import {
  getMirrorContentUrl,
  loadAidlJavaFiles,
  searchFilePathByRefName,
  toAndroidApiResolution,
  type AndroidApiQueryRuntime,
  type QueryAndroidApiOptions,
} from '@android-cs/api-query';
import { generateAndroidApiCode } from '@android-cs/api-query/code';
import { queryAndroidApi } from '@android-cs/api-query/query';
import { computed, ref } from 'vue';

type CommandName = 'resolve' | 'source' | 'query' | 'generate' | 'preload';

interface CommandOption {
  name: CommandName;
  label: string;
  description: string;
}

const commands: CommandOption[] = [
  {
    name: 'resolve',
    label: 'Resolve',
    description:
      'Resolve an API name to its file, target path, and target kind.',
  },
  {
    name: 'query',
    label: 'Query',
    description:
      'Inspect cross-version ranges, signatures, and source coordinates.',
  },
  {
    name: 'source',
    label: 'Source',
    description: 'Fetch one tagged source file through the local CLI cache.',
  },
  {
    name: 'generate',
    label: 'Generate',
    description: 'Generate Java hidden-API code with one command.',
  },
  {
    name: 'preload',
    label: 'Preload',
    description: 'Preload several API queries before a larger task.',
  },
];

const activeCommandName = ref<CommandName>('query');
const apiName = ref('IActivityManager.getTasks');
const apiNamesText = ref(
  ['IActivityManager.getTasks', 'ActivityThread.currentApplication'].join('\n'),
);
const sourceTag = ref('android-17.0.0_r1');
const sourcePath = ref(
  'core/java/android/accessibilityservice/AccessibilityButtonController.java',
);
const minSdk = ref<string | number>('35');
const loading = ref(false);
const errorText = ref('');
const resultText = ref('');
const copiedKey = ref('');

const cliInstallCommand = 'npm install --global android-api-diff@latest';
const skillInstallCommand = 'android-api-diff skill install';

const activeCommand = computed(
  () => commands.find((command) => command.name === activeCommandName.value)!,
);

const browserRuntime: AndroidApiQueryRuntime = {
  fetchText: (url) => persistentFetch(url),
  loadAndroidVersionList: async () => androidVersionList,
};

const parseOptionalNumber = (
  value: string | number | null | undefined,
): number | undefined => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
};

const getVersionOptions = () => {
  return {
    minSdk: parseOptionalNumber(minSdk.value),
  };
};

const getQueryOptions = (name = apiName.value): QueryAndroidApiOptions => {
  return {
    apiName: name.trim(),
    ...getVersionOptions(),
    concurrency: 5,
  };
};

const getPreloadApiNames = (): string[] => {
  return apiNamesText.value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const quoteArgument = (value: string): string => JSON.stringify(value.trim());

const minSdkArgument = computed(() => {
  const value = parseOptionalNumber(minSdk.value);
  return value === undefined ? '' : ` --min-sdk ${value}`;
});

const commandText = computed(() => {
  if (activeCommandName.value === 'resolve') {
    return `android-api-diff resolve ${quoteArgument(apiName.value)}`;
  }
  if (activeCommandName.value === 'source') {
    return `android-api-diff source ${quoteArgument(sourceTag.value)} ${quoteArgument(sourcePath.value)}`;
  }
  if (activeCommandName.value === 'preload') {
    const names = getPreloadApiNames().map(quoteArgument).join(' ');
    return `android-api-diff preload ${names}${minSdkArgument.value}`;
  }
  return `android-api-diff ${activeCommandName.value} ${quoteArgument(apiName.value)}${minSdkArgument.value}`;
});

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const copyText = async (key: string, value: string) => {
  await navigator.clipboard.writeText(value);
  copiedKey.value = key;
  window.setTimeout(() => {
    if (copiedKey.value === key) copiedKey.value = '';
  }, 1200);
};

const runResolvePreview = async () => {
  const name = apiName.value.trim();
  const files = await loadAidlJavaFiles(browserRuntime);
  return {
    apiName: name,
    result:
      toAndroidApiResolution(searchFilePathByRefName(name, files)) ?? null,
  };
};

const runQueryPreview = async () => {
  return queryAndroidApi(browserRuntime, getQueryOptions());
};

const runGeneratePreview = async () => {
  return generateAndroidApiCode(browserRuntime, getQueryOptions());
};

const runSourcePreview = async () => {
  const tag = sourceTag.value.trim();
  const path = sourcePath.value
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/?(?:frameworks\/base\/)?/, '');
  const url = getMirrorContentUrl(`${tag}/${path}`);
  const content = await browserRuntime.fetchText(url);
  if (content.startsWith('404:')) {
    throw new Error(`Source file not found: ${tag}/${path}`);
  }
  return {
    tag,
    path,
    url,
    content,
  };
};

const runPreloadPreview = async () => {
  const results = [];
  for (const name of getPreloadApiNames()) {
    const result = await queryAndroidApi(browserRuntime, getQueryOptions(name));
    results.push({
      apiName: name,
      checkedTags: result.summary.checkedTags,
      foundTags: result.summary.foundTags,
      rangeCount: result.summary.rangeCount,
    });
  }
  return {
    cacheDir: 'browser storage (preview only)',
    results,
  };
};

const runActiveCommand = async () => {
  errorText.value = '';
  resultText.value = '';
  loading.value = true;
  try {
    const result =
      activeCommandName.value === 'resolve'
        ? await runResolvePreview()
        : activeCommandName.value === 'source'
          ? await runSourcePreview()
          : activeCommandName.value === 'generate'
            ? await runGeneratePreview()
            : activeCommandName.value === 'query'
              ? await runQueryPreview()
              : await runPreloadPreview();
    const response = {
      ok: true,
      command: activeCommandName.value,
      result,
    };
    resultText.value = formatJson(response);
  } catch (error) {
    errorText.value =
      error instanceof Error
        ? error.message
        : formatJson(error ?? 'Unknown error');
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div
    font-github-mono
    min-h-100vh
    overflow-x-hidden
    bg="#f8fafc"
    text="#0f172a"
    text-14px
  >
    <div max-w-1180px mx-auto p-12px md:p-24px flex flex-col gap-16px>
      <header flex flex-wrap items-center gap-12px>
        <RouterLink
          to="/"
          text-black
          transition-color
          hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
        >
          android-api-diff
        </RouterLink>
        <div h-16px w-1px bg-gray-300></div>
        <div text-20px font-500>CLI + Skill</div>
        <div flex-1></div>
        <a
          href="https://github.com/android-cs/android-api-diff"
          target="_blank"
          rel="noopener noreferrer"
          text-black
          transition-color
          hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
        >
          GitHub
        </a>
      </header>

      <section>
        <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px min-w-0>
          <div text-12px uppercase tracking-1px text-gray-500 mb-8px>
            Install CLI
          </div>
          <div flex items-start gap-8px>
            <code class="cli-inline-code" flex-1>{{ cliInstallCommand }}</code>
            <button
              type="button"
              class="text-button"
              @click="copyText('cli-install', cliInstallCommand)"
            >
              {{ copiedKey === 'cli-install' ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <div text-12px uppercase tracking-1px text-gray-500 mt-14px mb-8px>
            Install project Skill
          </div>
          <div flex items-start gap-8px>
            <code class="cli-inline-code" flex-1>{{
              skillInstallCommand
            }}</code>
            <button
              type="button"
              class="text-button"
              @click="copyText('skill-install', skillInstallCommand)"
            >
              {{ copiedKey === 'skill-install' ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </div>
      </section>

      <main grid grid-cols-1 lg:grid-cols="[340px_minmax(0,1fr)]" gap-16px>
        <section flex flex-col gap-12px min-w-0>
          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div text-12px uppercase tracking-1px text-gray-500 mb-8px>
              Command builder
            </div>
            <div text-22px leading-28px mb-8px>Copy one command</div>
            <p m-0 text-gray-600 leading-20px break-words>
              The CLI starts only for the current request. The Skill teaches
              Codex which command to choose.
            </p>
          </div>

          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div text-12px uppercase tracking-1px text-gray-500 mb-10px>
              Command
            </div>
            <div flex flex-col gap-8px>
              <button
                v-for="command in commands"
                :key="command.name"
                type="button"
                w-full
                min-w-0
                text-left
                b-1px
                b-solid
                rounded-4px
                p-10px
                cursor-pointer
                transition-colors
                :class="
                  activeCommandName === command.name
                    ? 'bg-gray-950 text-white b-gray-950'
                    : 'bg-white b-gray-200 hover:bg-gray-50'
                "
                @click="activeCommandName = command.name"
              >
                <div flex flex-wrap items-center gap-8px min-w-0>
                  <span text-15px>{{ command.label }}</span>
                  <code text-11px opacity-80 break-all>{{ command.name }}</code>
                </div>
                <div mt-5px text-12px opacity-75 leading-16px break-words>
                  {{ command.description }}
                </div>
              </button>
            </div>
          </div>

          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div flex items-center gap-8px mb-8px>
              <div text-12px uppercase tracking-1px text-gray-500 flex-1>
                Shell command
              </div>
              <button
                type="button"
                class="text-button"
                @click="copyText('command', commandText)"
              >
                {{ copiedKey === 'command' ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <pre
              class="cli-code"
              m-0
              p-10px
              rounded-4px
              bg-gray-950
              text-gray-50
              leading-20px
            ><code>{{ commandText }}</code></pre>
          </div>
        </section>

        <section flex flex-col gap-12px min-w-0>
          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div flex flex-wrap items-center gap-8px mb-12px>
              <div>
                <h1 m-0 text-20px font-500>{{ activeCommand.label }}</h1>
                <div text-12px text-blue-700 mt-2px break-all>
                  android-api-diff {{ activeCommand.name }}
                </div>
              </div>
              <div flex-1></div>
              <button
                type="button"
                px-12px
                py-6px
                rounded-4px
                b-none
                bg-blue-100
                hover="bg-blue-200"
                active="bg-blue-300"
                cursor-pointer
                :disabled="loading"
                :class="{ 'cursor-wait opacity-70': loading }"
                @click="runActiveCommand"
              >
                {{ loading ? 'Running preview' : 'Run browser preview' }}
              </button>
            </div>

            <p m="0 0 12px" text-12px text-gray-500 leading-18px>
              The preview uses the browser query core and mirrors the CLI JSON
              response shape. Copy the shell command to run the local CLI.
            </p>

            <div grid grid-cols-1 md:grid-cols-2 gap-12px>
              <template v-if="activeCommandName === 'source'">
                <label flex flex-col gap-6px>
                  <span text-12px uppercase tracking-1px text-gray-500>
                    Android tag
                  </span>
                  <input
                    v-model="sourceTag"
                    type="text"
                    b-1px
                    b-solid
                    b-gray-200
                    rounded-4px
                    px-8px
                    py-6px
                    outline-none
                    focus="b-gray-500"
                  />
                </label>

                <label flex flex-col gap-6px>
                  <span text-12px uppercase tracking-1px text-gray-500>
                    Source path
                  </span>
                  <input
                    v-model="sourcePath"
                    type="text"
                    b-1px
                    b-solid
                    b-gray-200
                    rounded-4px
                    px-8px
                    py-6px
                    outline-none
                    focus="b-gray-500"
                  />
                </label>
              </template>

              <label
                v-else-if="activeCommandName !== 'preload'"
                flex
                flex-col
                gap-6px
              >
                <span text-12px uppercase tracking-1px text-gray-500>
                  API name
                </span>
                <input
                  v-model="apiName"
                  type="text"
                  b-1px
                  b-solid
                  b-gray-200
                  rounded-4px
                  px-8px
                  py-6px
                  outline-none
                  focus="b-gray-500"
                />
              </label>

              <label v-else flex flex-col gap-6px>
                <span text-12px uppercase tracking-1px text-gray-500>
                  API names
                </span>
                <textarea
                  v-model="apiNamesText"
                  rows="4"
                  b-1px
                  b-solid
                  b-gray-200
                  rounded-4px
                  px-8px
                  py-6px
                  outline-none
                  focus="b-gray-500"
                ></textarea>
              </label>

              <label
                v-if="
                  activeCommandName !== 'resolve' &&
                  activeCommandName !== 'source'
                "
                flex
                flex-col
                gap-6px
              >
                <span text-12px uppercase tracking-1px text-gray-500>
                  minSdk
                </span>
                <input
                  v-model="minSdk"
                  type="number"
                  min="1"
                  b-1px
                  b-solid
                  b-gray-200
                  rounded-4px
                  px-8px
                  py-6px
                  outline-none
                  focus="b-gray-500"
                />
              </label>
            </div>
          </div>

          <div
            v-if="errorText"
            bg-red-50
            text-red-800
            b-1px
            b-solid
            b-red-200
            rounded-6px
            p-14px
          >
            <div text-12px uppercase tracking-1px mb-8px>Error</div>
            <pre class="cli-code" m-0 leading-20px>{{ errorText }}</pre>
          </div>

          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px min-w-0>
            <div flex items-center gap-8px mb-8px>
              <div text-12px uppercase tracking-1px text-gray-500 flex-1>
                Preview result
              </div>
              <button
                v-if="resultText"
                type="button"
                class="text-button"
                @click="copyText('result', resultText)"
              >
                {{ copiedKey === 'result' ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <div
              v-if="!resultText && !loading"
              text-gray-500
              bg-gray-50
              rounded-4px
              p-12px
            >
              Run the browser preview, or copy the command to use the CLI.
            </div>
            <div
              v-else-if="loading"
              text-gray-500
              bg-gray-50
              rounded-4px
              p-12px
            >
              Fetching Android source metadata...
            </div>
            <pre
              v-else
              class="cli-code"
              m-0
              p-10px
              rounded-4px
              bg-gray-950
              text-gray-50
              leading-20px
            ><code>{{ resultText }}</code></pre>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.cli-code,
.cli-inline-code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.cli-inline-code {
  min-width: 0;
  color: #1f2937;
  line-height: 20px;
}

.text-button {
  flex: none;
  border: 0;
  background: transparent;
  padding: 0;
  color: #6b7280;
  cursor: pointer;
}

.text-button:hover {
  color: #111827;
}
</style>
