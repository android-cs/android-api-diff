<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue';
import { estimateDesc } from '@/store';
import androidVersionList from '@/utils/android.data';
import { clearLocalCache } from '@/utils/cache';
import TagCard from '@/views/home/TagCard.vue';
import { useEventListener, useStorage } from '@vueuse/core';
import { computed, onMounted, ref } from 'vue';
import DiffResultList from './DiffResultList.vue';
import { skipNextAutoDiffOnReload, useSharedHomeState } from './homeState';

const DEFAULT_SEARCH_HISTORY = [
  'IActivityTaskManager.getTasks',
  'ITaskStackListener.onTaskMovedToFront',
  'IUserManager.getUsers',
];
const MAX_SEARCH_HISTORY = 10;

const normalizeSearchHistory = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const ref = item.trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    list.push(ref);
    if (list.length >= MAX_SEARCH_HISTORY) break;
  }
  return list;
};

const title = document.title;
const {
  handleDiff,
  isCanParsedUrl,
  isValidSearchRef,
  searchRef,
  setSearchRef,
  stopDiff,
  androidVersionColors,
} = useSharedHomeState();

const searchHistory = useStorage<string[]>(
  'android-api-diff:search-history:v1',
  () => [...DEFAULT_SEARCH_HISTORY],
  undefined,
  {
    flush: 'sync',
    serializer: {
      read: (raw) => {
        try {
          return normalizeSearchHistory(JSON.parse(raw));
        } catch {
          return [...DEFAULT_SEARCH_HISTORY];
        }
      },
      write: (value) => JSON.stringify(normalizeSearchHistory(value)),
    },
  },
);
const isSearchInputFocused = ref(false);
const isSearchHistoryPanelOpen = ref(false);
const stickyDiffResultRef = ref<HTMLElement>();
const isDiffResultSticky = ref(false);

const showSearchHistory = computed(
  () =>
    isSearchInputFocused.value &&
    isSearchHistoryPanelOpen.value &&
    !isDiffResultSticky.value &&
    searchHistory.value.length > 0,
);

const clearSearchHistory = () => {
  searchHistory.value = [];
};

const saveValidSearchHistory = () => {
  const ref = searchRef.value.trim();
  if (!ref || !isValidSearchRef.value) return;
  searchHistory.value = [
    ref,
    ...searchHistory.value.filter((item) => item !== ref),
  ].slice(0, MAX_SEARCH_HISTORY);
};

const handleRunDiff = async () => {
  isSearchHistoryPanelOpen.value = false;
  saveValidSearchHistory();
  await handleDiff.invoke();
  saveValidSearchHistory();
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
  await setSearchRef(ref);
  saveValidSearchHistory();
  await handleDiff.invoke();
  saveValidSearchHistory();
};

const removeSearchHistory = (ref: string) => {
  searchHistory.value = searchHistory.value.filter((item) => item !== ref);
};

const updateStickyState = () => {
  const rect = stickyDiffResultRef.value?.getBoundingClientRect();
  isDiffResultSticky.value = !!rect && rect.top <= 0;
};
onMounted(updateStickyState);
useEventListener(window, 'scroll', updateStickyState, { passive: true });
useEventListener(window, 'resize', updateStickyState);

const handleClearLocalCache = async () => {
  if (!window.confirm('Do you want to clear local data?')) return;
  await clearLocalCache();
  clearSearchHistory();
  skipNextAutoDiffOnReload();
  window.location.reload();
};
</script>
<template>
  <div font-github-mono p-12px text-14px flex flex-col class="[--gap:8px]">
    <div mb="--gap" flex items-center gap-24px>
      <div text-20px font-400>{{ title }}</div>
      <div flex-1></div>
      <div
        v-if="estimateDesc"
        flex
        items-center
        gap-4px
        cursor-pointer
        select-none
        title="Click to clear local data"
        @click="handleClearLocalCache"
      >
        <SvgIcon name="database" size-20px />
        <div text-14px>{{ estimateDesc }}</div>
      </div>
      <a
        href="https://github.com/android-cs/android-api-diff"
        target="_blank"
        text-black
        transition-color
        hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
      >
        <SvgIcon name="github" size-20px />
      </a>
    </div>
    <div flex gap-24px items-center>
      <div relative flex-1 min-w-0>
        <input
          w-full
          box-border
          type="text"
          v-model="searchRef"
          placeholder="Please input Java/AIDL Member Reference"
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
          <ul
            m-0
            p-8px
            list-none
            flex
            flex-wrap
            gap-8px
            max-h-160px
            overflow-y-auto
          >
            <li
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
            </li>
          </ul>
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
        <SvgIcon name="loading" size-16px v-if="handleDiff.loading" />
        <div>{{ handleDiff.loading ? `STOP` : `DIFF` }}</div>
      </div>
    </div>
    <div ref="stickyDiffResultRef" pt="--gap" sticky top-0 bg-white>
      <DiffResultList />
    </div>
    <div mb="--gap" flex gap-16px overflow-scroll hidden-scrollbar>
      <div
        v-for="item in androidVersionList"
        :key="item.version"
        flex-1
        flex
        flex-col
        items-center
      >
        <div
          h-2px
          w-full
          flex
          :class="{ 'bg-cyan-200': !androidVersionColors[item.version].length }"
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
