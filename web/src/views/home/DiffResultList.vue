<script setup lang="ts">
import MOption from '@/components/MOption.vue';
import MSelect from '@/components/MSelect.vue';
import MSvg from '@/components/MSvg.vue';
import { useElementSize } from '@vueuse/core';
import { computed, shallowRef } from 'vue';
import { ANDROID_PREFIX_LEN, useSharedHomeState } from './homeState.ts';

const {
  androidVersionList,
  diffTypeReult,
  overloadOptions,
  selectedOverloadKey,
} = useSharedHomeState();
const props = defineProps<{
  copyText?: string;
}>();
const emit = defineEmits<{
  'open-code': [];
}>();

const viewRef = shallowRef<HTMLElement>();
const { height } = useElementSize(viewRef);
const isCopied = shallowRef(false);
const ALL_OVERLOADS_VALUE = '__all_overloads__';

const selectedOverloadValue = computed({
  get: () => selectedOverloadKey.value ?? ALL_OVERLOADS_VALUE,
  set: (value: string) => {
    selectedOverloadKey.value = value === ALL_OVERLOADS_VALUE ? null : value;
  },
});
const selectedOverloadLabel = computed(() => {
  if (!selectedOverloadKey.value) {
    return `All overloads (${overloadOptions.value.length})`;
  }
  return (
    overloadOptions.value.find(
      (option) => option.key === selectedOverloadKey.value,
    )?.label ?? `All overloads (${overloadOptions.value.length})`
  );
});
const selectedOverloadDisplayLabel = computed(() => {
  const selected = selectedOverloadKey.value;
  if (!selected) return selectedOverloadLabel.value;
  const index = overloadOptions.value.findIndex(
    (option) => option.key === selected,
  );
  const option = overloadOptions.value[index];
  if (!option) return selectedOverloadLabel.value;
  if (option.parameterCount <= 2) {
    return `${index + 1}/${overloadOptions.value.length} · ${option.label}`;
  }
  const methodName = option.label.substring(0, option.label.indexOf('('));
  return `${index + 1}/${overloadOptions.value.length} · ${methodName}(${option.parameterCount} args)`;
});

const getTagRangeDesc = (range: string[]): string => {
  if (range.length === 1) return range[0].substring(ANDROID_PREFIX_LEN);
  let st = range[0];
  let ed = range.at(-1)!;
  const bigSt = androidVersionList.value.find((v) => v.tags[0] === st)?.version;
  const bigEd = androidVersionList.value.find(
    (v) => v.tags.at(-1) === ed,
  )?.version;
  st = st.substring(ANDROID_PREFIX_LEN);
  ed = ed.substring(ANDROID_PREFIX_LEN);
  if (bigSt || bigEd) {
    if (bigSt && bigEd && bigSt === bigEd) return bigSt;
    return `${bigSt ?? st} - ${bigEd ?? ed}`;
  }
  return `${st} - ${ed}`;
};

const copyMemberCode = async () => {
  if (!props.copyText) return;
  await navigator.clipboard.writeText(props.copyText);
  isCopied.value = true;
  window.setTimeout(() => {
    isCopied.value = false;
  }, 1200);
};
</script>
<template>
  <div
    ref="wrapRef"
    overflow-hidden
    transition-height
    class="[--un-duration:500ms]"
    :style="{ height: height && `calc(${height}px + var(--gap))` }"
  >
    <div v-if="diffTypeReult.length" ref="viewRef" flex items-start gap-8px>
      <div flex flex-1 min-w-0 flex-col gap-6px>
        <MSelect
          v-if="overloadOptions.length > 1"
          v-model="selectedOverloadValue"
          class="overload-select"
          label="Overload"
          trigger-min-width="0"
          popover-min-width="320px"
          self-start
        >
          <template #value>
            <span
              block
              max-w-520px
              overflow-hidden
              text-ellipsis
              whitespace-nowrap
              :title="selectedOverloadLabel"
            >
              {{ selectedOverloadDisplayLabel }}
            </span>
          </template>
          <MOption :value="ALL_OVERLOADS_VALUE">
            <span>All overloads ({{ overloadOptions.length }})</span>
          </MOption>
          <MOption
            v-for="option in overloadOptions"
            :key="option.key"
            :value="option.key"
          >
            <code class="overload-option-label">{{ option.label }}</code>
          </MOption>
        </MSelect>
        <div flex flex-wrap gap-row-4px gap-col-24px>
          <div
            v-for="item in diffTypeReult"
            :key="`${item.typeColor}:${item.typeDesc}`"
            flex
            gap-8px
            items-center
            leading-20px
          >
            <div size-16px :style="{ background: item.typeColor }"></div>
            <div
              v-if="item.typeDesc"
              font-500
              bg-gray-200
              px-4px
              rounded-4px
              whitespace-pre
            >
              {{ item.typeDesc }}
            </div>
            <div flex gap-8px flex-wrap>
              <div
                v-for="range in item.tagRanges"
                :key="range[0]"
                px-4px
                bg-gray-100
                rounded-4px
              >
                {{ getTagRangeDesc(range) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="copyText" flex flex-none items-center gap-4px>
        <button
          type="button"
          size-20px
          p-0
          flex
          items-center
          justify-center
          b-none
          rounded-4px
          bg-transparent
          cursor-pointer
          text-gray-500
          transition-colors
          hover="bg-gray-100 text-black"
          active="bg-gray-200"
          :aria-label="isCopied ? 'Member code copied' : 'Copy member code'"
          :title="isCopied ? 'Copied' : 'Copy member code'"
          @click="copyMemberCode"
        >
          <MSvg name="copy" size-20px />
        </button>
        <button
          type="button"
          size-20px
          p-0
          flex
          items-center
          justify-center
          b-none
          rounded-4px
          bg-transparent
          cursor-pointer
          text-gray-500
          transition-colors
          hover="bg-gray-100 text-black"
          active="bg-gray-200"
          aria-label="Open generated code"
          title="Open generated code"
          @click="emit('open-code')"
        >
          <MSvg name="code" size-20px />
        </button>
      </div>
      <span sr-only aria-live="polite">
        {{ isCopied ? 'Member code copied' : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.overload-select {
  width: min(100%, 640px);
}

.overload-select :deep([role='button']) {
  min-width: 0;
  flex: 1;
}

.overload-select :deep([role='button'] > span) {
  min-width: 0;
}

.overload-option-label {
  max-width: min(680px, calc(100vw - 64px));
  overflow-wrap: anywhere;
}
</style>
