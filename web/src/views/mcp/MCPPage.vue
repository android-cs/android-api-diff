<script setup lang="ts">
import { persistentFetch } from '@/utils/cache';
import androidVersionList from '@/utils/android.data';
import {
  loadAidlJavaFiles,
  searchFilePathByRefName,
  toAndroidApiResolution,
  type AndroidApiQueryRuntime,
  type QueryAndroidApiOptions,
} from '@android-cs/api-query';
import { queryAndroidApi } from '@android-cs/api-query/query';
import { computed, ref } from 'vue';

type ToolName =
  | 'resolve_android_api'
  | 'query_android_api'
  | 'warm_android_api_cache';

interface ToolOption {
  name: ToolName;
  label: string;
  description: string;
}

const tools: ToolOption[] = [
  {
    name: 'resolve_android_api',
    label: 'Resolve',
    description: 'Resolve an API name to file, target path, and target kind.',
  },
  {
    name: 'query_android_api',
    label: 'Query',
    description:
      'Fetch cross-version ranges, signatures, and source coordinates.',
  },
  {
    name: 'warm_android_api_cache',
    label: 'Warm',
    description: 'Run several API queries to preload browser-side fetch cache.',
  },
];

const activeToolName = ref<ToolName>('query_android_api');
const apiName = ref('IActivityManager.getTasks');
const apiNamesText = ref(
  ['IActivityManager.getTasks', 'ActivityThread.currentApplication'].join('\n'),
);
const minSdk = ref<string | number>('35');
const concurrency = ref<string | number>('3');
const loading = ref(false);
const errorText = ref('');
const resultText = ref('');
const copiedKey = ref('');

const activeTool = computed(
  () => tools.find((tool) => tool.name === activeToolName.value)!,
);

const browserRuntime: AndroidApiQueryRuntime = {
  fetchText: persistentFetch,
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

const parseConcurrency = (
  value: string | number | null | undefined,
): number | undefined => {
  const number = parseOptionalNumber(value);
  if (number === undefined) return;
  return Math.min(8, Math.max(1, Math.floor(number)));
};

const getVersionOptions = () => {
  return {
    minSdk: parseOptionalNumber(minSdk.value),
  };
};

const getMcpQueryArguments = (name = apiName.value) => {
  return {
    apiName: name.trim(),
    ...getVersionOptions(),
  };
};

const getQueryOptions = (name = apiName.value): QueryAndroidApiOptions => {
  return {
    ...getMcpQueryArguments(name),
    concurrency: parseConcurrency(concurrency.value),
  };
};

const getWarmApiNames = (): string[] => {
  return apiNamesText.value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const requestPayload = computed(() => {
  if (activeToolName.value === 'resolve_android_api') {
    return {
      tool: activeToolName.value,
      arguments: {
        apiName: apiName.value.trim(),
      },
    };
  }
  if (activeToolName.value === 'query_android_api') {
    return {
      tool: activeToolName.value,
      arguments: getMcpQueryArguments(),
    };
  }
  return {
    tool: activeToolName.value,
    arguments: {
      apiNames: getWarmApiNames(),
      ...getVersionOptions(),
    },
  };
});

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const copyText = async (key: string, value: string) => {
  await navigator.clipboard.writeText(value);
  copiedKey.value = key;
  window.setTimeout(() => {
    if (copiedKey.value === key) copiedKey.value = '';
  }, 1200);
};

const runResolveTool = async () => {
  const files = await loadAidlJavaFiles(browserRuntime);
  return {
    tool: 'resolve_android_api',
    arguments: {
      apiName: apiName.value.trim(),
    },
    result: toAndroidApiResolution(
      searchFilePathByRefName(apiName.value, files),
    ),
  };
};

const runQueryTool = async () => {
  return queryAndroidApi(browserRuntime, getQueryOptions());
};

const runWarmTool = async () => {
  const results = [];
  for (const name of getWarmApiNames()) {
    const result = await queryAndroidApi(browserRuntime, getQueryOptions(name));
    results.push({
      apiName: name,
      checkedTags: result.summary.checkedTags,
      foundTags: result.summary.foundTags,
      rangeCount: result.summary.rangeCount,
      signatures: result.summary.signatures,
    });
  }
  return {
    tool: 'warm_android_api_cache',
    result: results,
  };
};

const runActiveTool = async () => {
  errorText.value = '';
  resultText.value = '';
  loading.value = true;
  try {
    const result =
      activeToolName.value === 'resolve_android_api'
        ? await runResolveTool()
        : activeToolName.value === 'query_android_api'
          ? await runQueryTool()
          : await runWarmTool();
    resultText.value = formatJson(result);
  } catch (error) {
    errorText.value =
      error instanceof Error ? error.message : formatJson(error ?? 'Unknown');
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
        <div text-20px font-500>MCP</div>
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

      <main grid grid-cols-1 lg:grid-cols="[340px_minmax(0,1fr)]" gap-16px>
        <section flex flex-col gap-12px min-w-0>
          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div text-12px uppercase tracking-1px text-gray-500 mb-8px>
              Playground
            </div>
            <div text-22px leading-28px mb-8px>Run MCP tools</div>
            <p m-0 text-gray-600 leading-20px break-words>
              Trigger the same Android API capabilities exposed by the MCP
              server from this browser page.
            </p>
          </div>

          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div text-12px uppercase tracking-1px text-gray-500 mb-10px>
              Tool
            </div>
            <div flex flex-col gap-8px>
              <button
                v-for="tool in tools"
                :key="tool.name"
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
                  activeToolName === tool.name
                    ? 'bg-gray-950 text-white b-gray-950'
                    : 'bg-white b-gray-200 hover:bg-gray-50'
                "
                @click="activeToolName = tool.name"
              >
                <div flex flex-wrap items-center gap-8px min-w-0>
                  <span text-15px>{{ tool.label }}</span>
                  <code text-11px opacity-80 break-all>{{ tool.name }}</code>
                </div>
                <div mt-5px text-12px opacity-75 leading-16px break-words>
                  {{ tool.description }}
                </div>
              </button>
            </div>
          </div>

          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div flex items-center gap-8px mb-8px>
              <div text-12px uppercase tracking-1px text-gray-500 flex-1>
                Request
              </div>
              <button
                type="button"
                b-none
                bg-transparent
                p-0
                cursor-pointer
                text-gray-500
                hover="text-black"
                @click="copyText('request', formatJson(requestPayload))"
              >
                {{ copiedKey === 'request' ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <pre
              class="mcp-code"
              m-0
              p-10px
              rounded-4px
              bg-gray-950
              text-gray-50
              leading-20px
            ><code>{{ formatJson(requestPayload) }}</code></pre>
          </div>
        </section>

        <section flex flex-col gap-12px min-w-0>
          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px>
            <div flex flex-wrap items-center gap-8px mb-12px>
              <div>
                <h1 m-0 text-20px font-500>{{ activeTool.label }}</h1>
                <div text-12px text-blue-700 mt-2px break-all>
                  {{ activeTool.name }}
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
                @click="runActiveTool"
              >
                {{ loading ? 'Running' : 'Run' }}
              </button>
            </div>

            <div grid grid-cols-1 md:grid-cols-2 gap-12px>
              <label flex flex-col gap-6px>
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

              <label
                v-if="activeToolName === 'warm_android_api_cache'"
                flex
                flex-col
                gap-6px
              >
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

              <template v-if="activeToolName !== 'resolve_android_api'">
                <label flex flex-col gap-6px>
                  <span text-12px uppercase tracking-1px text-gray-500>
                    minSdk
                  </span>
                  <input
                    v-model="minSdk"
                    type="number"
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
                    concurrency
                  </span>
                  <input
                    v-model="concurrency"
                    type="number"
                    min="1"
                    max="8"
                    step="1"
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
            <pre class="mcp-code" m-0 leading-20px>{{ errorText }}</pre>
          </div>

          <div bg-white b-1px b-solid b-gray-200 rounded-6px p-14px min-w-0>
            <div flex items-center gap-8px mb-8px>
              <div text-12px uppercase tracking-1px text-gray-500 flex-1>
                Result
              </div>
              <button
                v-if="resultText"
                type="button"
                b-none
                bg-transparent
                p-0
                cursor-pointer
                text-gray-500
                hover="text-black"
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
              Click Run to call the selected MCP tool capability.
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
              class="mcp-code"
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
.mcp-code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-all;
}
</style>
