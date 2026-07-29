<script setup lang="ts">
import MSvg from '@/components/MSvg.vue';
import MPopconfirm from '@/components/MPopconfirm.vue';
import { estimateDesc } from '@/store';
import { clearLocalCache } from '@/utils/cache';
import TagCard from '@/views/home/TagCard.vue';
import type {
  AndroidApiQueryResult,
  AndroidApiResolvedType,
} from '@android-cs/api-query';
import {
  findStructPathByPath,
  toAndroidApiResolvedType,
} from '@android-cs/api-query';
import {
  renderAndroidApiCodeWithMemberCode,
  toAndroidApiMemberResult,
} from '@android-cs/api-query/code-render';
import {
  normalizeAndroidApiMemberRanges,
  type AndroidApiMemberVersionRangeInput,
} from '@android-cs/api-query/query';
import { useEventListener } from '@vueuse/core';
import { computed, onMounted, ref } from 'vue';
import DiffConcurrentSelect from './DiffConcurrentSelect.vue';
import DiffResultList from './DiffResultList.vue';
import { skipNextAutoDiffOnReload, useSharedHomeState } from './homeState.ts';
import MinSdkSelect from './MinSdkSelect.vue';
import SourceLinkTargetSelect from './SourceLinkTargetSelect.vue';

const title = document.title;
const {
  handleDiff,
  isCanParsedUrl,
  searchHistory,
  searchRef,
  runDiffWithSearchHistory,
  selectSearchHistory,
  removeSearchHistory,
  stopDiff,
  androidVersionColors,
  androidVersionList,
  diffResultList,
  searchFromData,
} = useSharedHomeState();

const isSearchInputFocused = ref(false);
const isSearchHistoryPanelOpen = ref(false);
const stickyDiffResultRef = ref<HTMLElement>();
const versionColorScrollRef = ref<HTMLElement>();
const versionListScrollRef = ref<HTMLElement>();
const codeDialogRef = ref<HTMLDialogElement>();
const isDiffResultSticky = ref(false);
const isCodeCopied = ref(false);

const showSearchHistory = computed(
  () =>
    isSearchInputFocused.value &&
    isSearchHistoryPanelOpen.value &&
    !isDiffResultSticky.value &&
    searchHistory.value.length > 0,
);

const handleRunDiff = async () => {
  isSearchHistoryPanelOpen.value = false;
  await runDiffWithSearchHistory();
};

const openCodeDialog = () => {
  const dialog = codeDialogRef.value;
  if (!dialog || dialog.open) return;
  dialog.showModal();
};

const closeCodeDialog = () => {
  codeDialogRef.value?.close();
};

const versionInfoByTag = computed(() => {
  const map = new Map<string, AndroidVersionItem>();
  for (const version of androidVersionList.value) {
    for (const tag of version.tags) {
      map.set(tag, version);
    }
  }
  return map;
});

const getRangeFromDiffResult = (
  item: DiffResultItem,
  importIndexes: Map<string, number>,
): AndroidApiMemberVersionRangeInput | undefined => {
  const version = versionInfoByTag.value.get(item.tag);
  if (!version) return;
  const members = item.members
    ? [...item.members]
        .sort((a, b) => (a.parameterCount ?? 0) - (b.parameterCount ?? 0))
        .map((member) => {
          const result = toAndroidApiMemberResult(member);
          result.imports = Array.from(
            new Set(
              result.imports.map((index) => {
                const importName = item.file.imports[index];
                if (importName === undefined) {
                  throw new Error(`Invalid member import index: ${index}`);
                }
                return importIndexes.get(importName)!;
              }),
            ),
          ).sort((a, b) => a - b);
          return result;
        })
    : undefined;
  const missingReason =
    item.notFound || (!item.target && !members?.length)
      ? item.notFound
        ? 'source-file-not-found'
        : 'api-not-found'
      : undefined;
  return {
    fromVersion: version.version,
    fromAlias: version.alias,
    fromApiVersion: version.apiVersion,
    fromTag: item.tag,
    toVersion: version.version,
    toAlias: version.alias,
    toApiVersion: version.apiVersion,
    toTag: item.tag,
    ...(missingReason ? { missingReason } : {}),
    ...(members ? { members } : {}),
  };
};

const getLatestResolvedTypePath = (): AndroidApiResolvedType[] | undefined => {
  const targetPaths =
    searchFromData.value.targetKind === 'member'
      ? searchFromData.value.targetPaths.slice(0, -1)
      : searchFromData.value.targetPaths;
  if (targetPaths.length === 0) return;
  for (let index = diffResultList.value.length - 1; index >= 0; index--) {
    const path = findStructPathByPath(
      diffResultList.value[index]?.structs,
      targetPaths,
    );
    if (!path) continue;
    return path.map(toAndroidApiResolvedType);
  }
};

const codeQueryResult = computed<AndroidApiQueryResult>(() => {
  const usedImports = new Set<string>();
  for (const item of diffResultList.value) {
    for (const member of item.members ?? []) {
      for (const index of member.imports) {
        const importName = item.file.imports[index];
        if (importName === undefined) {
          throw new Error(`Invalid member import index: ${index}`);
        }
        usedImports.add(importName);
      }
    }
  }
  const imports = Array.from(usedImports).sort();
  const importIndexes = new Map(
    imports.map((value, index) => [value, index] as const),
  );
  const memberRanges = diffResultList.value
    .map((item) => getRangeFromDiffResult(item, importIndexes))
    .filter((range): range is AndroidApiMemberVersionRangeInput => !!range);
  const foundRanges = memberRanges.filter((range) => !range.missingReason);
  const { ranges, overloads } = normalizeAndroidApiMemberRanges(memberRanges);
  const typePath = getLatestResolvedTypePath();
  return {
    apiName: searchRef.value,
    normalizedApiName: searchRef.value.trim(),
    package:
      diffResultList.value.findLast((item) => item.file.package)?.file
        .package ?? '',
    imports,
    source: {
      repo: 'platform/frameworks/base',
      path: searchFromData.value.filePath,
    },
    resolvedTarget: {
      kind: searchFromData.value.targetKind,
      paths: searchFromData.value.targetPaths,
      ...(typePath ? { typePath } : {}),
    },
    summary: {
      checkedTags: ranges.length,
      foundTags: foundRanges.length,
      rangeCount: ranges.length,
      overloadCount: overloads.length,
      ...(foundRanges[0] ? { firstFoundTag: foundRanges[0].fromTag } : {}),
      ...(foundRanges.at(-1)
        ? { lastFoundTag: foundRanges.at(-1)!.toTag }
        : {}),
    },
    ranges,
    overloads,
  };
});

const generatedCodeResult = computed(() =>
  renderAndroidApiCodeWithMemberCode(codeQueryResult.value),
);

const generatedCodeText = computed(() => generatedCodeResult.value.code);

const generatedMemberCodeText = computed(() => {
  if (searchFromData.value.targetKind !== 'member') return '';
  return generatedCodeResult.value.memberCode;
});

const handleGenerateCode = async () => {
  if (!isCanParsedUrl.value) return;
  isSearchHistoryPanelOpen.value = false;
  isCodeCopied.value = false;
  openCodeDialog();
};

const copyGeneratedCode = async () => {
  if (!generatedCodeText.value) return;
  await navigator.clipboard.writeText(generatedCodeText.value);
  isCodeCopied.value = true;
  window.setTimeout(() => {
    isCodeCopied.value = false;
  }, 1200);
};

const handleSearchInputFocus = () => {
  isSearchInputFocused.value = true;
};

const handleSearchInputClick = () => {
  isSearchInputFocused.value = true;
  isSearchHistoryPanelOpen.value = true;
};

const handleSearchInputInput = () => {
  if (!isSearchInputFocused.value) return;
  isSearchHistoryPanelOpen.value = true;
};

const handleSearchInputBlur = () => {
  isSearchInputFocused.value = false;
  isSearchHistoryPanelOpen.value = false;
};

const handleSelectSearchHistory = async (ref: string) => {
  isSearchInputFocused.value = false;
  isSearchHistoryPanelOpen.value = false;
  await selectSearchHistory(ref);
};

const updateStickyState = () => {
  const rect = stickyDiffResultRef.value?.getBoundingClientRect();
  isDiffResultSticky.value = !!rect && rect.top <= 0;
};
onMounted(updateStickyState);
useEventListener(window, 'scroll', updateStickyState, { passive: true });
useEventListener(window, 'resize', updateStickyState);

const syncScrollLeft = (
  source: HTMLElement | undefined,
  target: HTMLElement | undefined,
) => {
  if (!source || !target || source.scrollLeft === target.scrollLeft) return;
  target.scrollLeft = source.scrollLeft;
};

const syncVersionColorScroll = () => {
  syncScrollLeft(versionColorScrollRef.value, versionListScrollRef.value);
};

const syncVersionListScroll = () => {
  syncScrollLeft(versionListScrollRef.value, versionColorScrollRef.value);
};

const handleClearLocalCache = async () => {
  await clearLocalCache();
  await new Promise((r) => setTimeout(r, 500));
  skipNextAutoDiffOnReload();
  location.reload();
};
</script>
<template>
  <div
    font-github-mono
    p-12px
    text-14px
    flex
    flex-col
    class="[--gap:8px] [--android-col-w:100px]"
  >
    <div mb="--gap" flex items-center gap-24px>
      <div text-20px font-400>{{ title }}</div>
      <MPopconfirm
        v-if="estimateDesc"
        title="Clear local data?"
        message="Cached diff data will be removed, then the page will reload."
        confirm-text="Clear"
        placement="bottom-start"
        @confirm="handleClearLocalCache"
      >
        <template #trigger="{ toggle, linkPopover }">
          <span
            :ref="linkPopover"
            flex
            items-center
            gap-4px
            cursor-pointer
            select-none
            title="Click to clear local data"
            transition-color
            hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
            @click="toggle"
          >
            <MSvg name="database" size-16px />
            <span text-14px>{{ estimateDesc }}</span>
          </span>
        </template>
      </MPopconfirm>
      <div flex-1></div>
      <SourceLinkTargetSelect />
      <MinSdkSelect />
      <DiffConcurrentSelect />
      <RouterLink
        to="/cli"
        text-black
        transition-color
        hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
      >
        CLI + Skill
      </RouterLink>
      <a
        href="https://github.com/lisonge/remap"
        target="_blank"
        rel="noopener noreferrer"
        flex
        items-center
        gap-4px
        text-black
        title="Open remap helper tool"
        transition-color
        hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
      >
        <MSvg name="github" size-16px />
        <span text-14px>Remap</span>
      </a>
      <a
        href="https://github.com/android-cs/android-api-diff"
        target="_blank"
        rel="noopener noreferrer"
        flex
        items-center
        gap-4px
        text-black
        transition-color
        hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
      >
        <MSvg name="github" size-16px />
        <span text-14px>Diff</span>
      </a>
    </div>
    <div flex gap-24px items-center>
      <div relative flex-1 min-w-0>
        <input
          w-full
          box-border
          type="text"
          v-model="searchRef"
          placeholder="Class, Class(), or Class.member"
          outline-none
          transition-colors
          b-1px
          b-solid
          b-gray-200
          hover="b-gray-400"
          rounded-4px
          px-8px
          py-4px
          text-dark-100
          :disabled="handleDiff.loading"
          @focus="handleSearchInputFocus"
          @click="handleSearchInputClick"
          @input="handleSearchInputInput"
          @blur="handleSearchInputBlur"
          @keyup.enter="handleRunDiff()"
        />
        <div
          v-if="showSearchHistory"
          absolute
          left-0
          right-0
          z-20
          bg-white
          b-1px
          b-solid
          b-gray-200
          rounded-4px
          shadow
          style="top: calc(100% + 4px)"
          @mousedown.prevent
        >
          <div m-0 p-8px flex flex-wrap gap-8px max-h-160px overflow-y-auto>
            <div
              v-for="item in searchHistory"
              :key="item"
              max-w-full
              min-w-0
              flex
              items-center
              gap-8px
              b-1px
              b-solid
              b-gray-200
              rounded-4px
              px-8px
              py-4px
              cursor-pointer
              select-none
              bg-gray-50
              hover="bg-gray-100 b-gray-400"
              transition-colors
              @click="handleSelectSearchHistory(item)"
            >
              <span min-w-0 overflow-hidden text-ellipsis whitespace-nowrap>
                {{ item }}
              </span>
              <button
                type="button"
                w-16px
                h-16px
                p-0
                flex
                items-center
                justify-center
                b-none
                rounded-4px
                bg-transparent
                cursor-pointer
                text-gray-500
                hover="bg-gray-200 text-gray-700"
                aria-label="Remove search history"
                title="Remove search history"
                @mousedown.prevent.stop
                @click.stop="removeSearchHistory(item)"
              >
                x
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        @click="handleDiff.loading ? stopDiff() : handleRunDiff()"
        px-12px
        rounded-xs
        flex
        items-center
        gap-4px
        text-16px
        cursor-pointer
        bg-blue-100
        hover="bg-blue-200"
        active="bg-blue-300"
        transition-colors
        select-none
        :class="{
          'cursor-not-allowed!': !isCanParsedUrl,
        }"
      >
        <MSvg name="loading" size-16px v-if="handleDiff.loading" />
        <div>{{ handleDiff.loading ? `STOP` : `DIFF` }}</div>
      </div>
    </div>
    <dialog
      ref="codeDialogRef"
      class="code-dialog"
      @close="isCodeCopied = false"
    >
      <div class="code-dialog-panel">
        <div
          flex
          items-center
          gap-12px
          px-16px
          py-12px
          b-b-1px
          b-b-solid
          b-gray-200
        >
          <div min-w-0 flex-1>
            <div text-16px font-600>Generated code</div>
            <div text-12px text-gray-500 break-all>{{ searchRef }}</div>
          </div>
          <button
            type="button"
            class="code-dialog-close"
            aria-label="Close generated code"
            title="Close"
            @click="closeCodeDialog"
          >
            <MSvg name="close" size-24px />
          </button>
        </div>
        <div p-16px>
          <div
            v-if="!generatedCodeText"
            bg-gray-50
            b-1px
            b-solid
            b-gray-200
            rounded-4px
            p-12px
            text-gray-500
          >
            {{
              handleDiff.loading
                ? 'Waiting for loaded Android API ranges...'
                : 'Run DIFF to load Android API ranges.'
            }}
          </div>
          <div v-else relative>
            <pre
              class="generated-code"
            ><code>{{ generatedCodeText }}</code></pre>
            <button
              type="button"
              class="generated-code-copy"
              :class="{ 'is-copied': isCodeCopied }"
              :aria-label="
                isCodeCopied ? 'Generated code copied' : 'Copy generated code'
              "
              :title="isCodeCopied ? 'Copied' : 'Copy generated code'"
              @click="copyGeneratedCode"
            >
              <MSvg name="copy" size-24px />
            </button>
            <span sr-only aria-live="polite">
              {{ isCodeCopied ? 'Generated code copied' : '' }}
            </span>
          </div>
        </div>
      </div>
    </dialog>
    <div ref="stickyDiffResultRef" pt="--gap" sticky top-0 z-10 bg-white>
      <DiffResultList
        :copy-text="generatedMemberCodeText"
        @open-code="handleGenerateCode"
      />
      <div
        ref="versionColorScrollRef"
        flex
        gap-16px
        overflow-x-auto
        hidden-scrollbar
        @scroll="syncVersionColorScroll"
      >
        <div
          v-for="item in androidVersionList"
          :key="item.version"
          flex-1
          min-w="--android-col-w"
        >
          <div
            h-2px
            w-full
            flex
            :class="{
              'bg-cyan-200': !androidVersionColors[item.version].length,
            }"
          >
            <div
              v-for="bg in androidVersionColors[item.version]"
              :key="bg"
              h-full
              flex-1
              :style="{
                background: bg,
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    <div
      ref="versionListScrollRef"
      mb="--gap"
      flex
      gap-16px
      overflow-x-auto
      hidden-scrollbar
      @scroll="syncVersionListScroll"
    >
      <div
        v-for="item in androidVersionList"
        :key="item.version"
        flex-1
        min-w="--android-col-w"
        flex
        flex-col
        items-center
      >
        <div text-12px leading-16px font-600 flex justify-center gap-4px>
          <div>{{ item.version }}</div>
          <div
            :class="{
              'text-10px': Number(item.version) >= 13,
            }"
          >
            {{ item.alias }}
          </div>
        </div>
        <div flex flex-col gap-4px>
          <TagCard v-for="tag in item.tags" :key="tag" :tag="tag" />
          <TagCard
            v-for="tag in item.futureTags"
            :key="tag"
            :tag="tag"
            future
          />
        </div>
      </div>
    </div>
    <div h-80px></div>
  </div>
</template>

<style scoped>
.code-dialog {
  position: fixed;
  inset: 0;
  width: min(960px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  margin: auto;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
}

.code-dialog::backdrop {
  background: rgb(15 23 42 / 48%);
}

.code-dialog-panel {
  display: flex;
  max-height: min(760px, calc(100vh - 32px));
  min-height: 220px;
  flex-direction: column;
}

.code-dialog-close,
.generated-code-copy {
  display: flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 120ms ease,
    background-color 120ms ease;
}

.code-dialog-close {
  flex: none;
  background: transparent;
  color: #6b7280;
}

.code-dialog-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.code-dialog-close:active {
  background: #e5e7eb;
}

.generated-code-copy {
  position: absolute;
  z-index: 1;
  top: 8px;
  right: 8px;
  background: #1f2937;
  color: #d1d5db;
}

.generated-code-copy:hover {
  background: #374151;
  color: #ffffff;
}

.generated-code-copy:active {
  background: #4b5563;
}

.generated-code-copy.is-copied {
  color: #86efac;
}

.generated-code {
  max-height: min(600px, calc(100vh - 170px));
  margin: 0;
  overflow: auto;
  border: 1px solid #111827;
  border-radius: 4px;
  background: #111827;
  padding: 12px 48px 12px 12px;
  color: #f9fafb;
  font-size: 13px;
  line-height: 20px;
  white-space: pre;
}
</style>
