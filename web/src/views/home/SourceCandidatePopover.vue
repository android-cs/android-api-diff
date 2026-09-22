<script setup lang="ts">
import MPopover from '@/components/MPopover.vue';
import MSvg from '@/components/MSvg.vue';
import { computed, ref, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import { useSharedHomeState } from './homeState.ts';

const {
  sourceCandidates,
  sourceSelectionInvalid,
  searchFromData,
  searchRef,
  selectSourcePath,
  handleDiff,
} = useSharedHomeState();
const popover = ref<InstanceType<typeof MPopover>>();
const trigger = ref<HTMLButtonElement>();
const anchor = ref<HTMLElement>();
const { width: inputWidth } = useElementSize(anchor);
const visible = computed(
  () => sourceCandidates.value.length > 1 || sourceSelectionInvalid.value,
);
const title = computed(() =>
  sourceSelectionInvalid.value
    ? 'Source unavailable — choose another source'
    : `Change source: ${searchFromData.value.filePath}`,
);
watch(searchRef, () => {
  void popover.value?.close();
});
watch(visible, (value) => {
  if (!value) void popover.value?.close();
});

const dismiss = () => {
  void popover.value?.close();
  trigger.value?.focus();
};

const select = async (path: string) => {
  if (handleDiff.loading) return;
  void popover.value?.close();
  trigger.value?.focus();
  await selectSourcePath(path);
};
</script>

<template>
  <div
    ref="anchor"
    class="source-candidate-anchor"
    @keydown.esc.stop.prevent="dismiss"
    :style="{ visibility: visible ? 'visible' : 'hidden' }"
  >
    <MPopover ref="popover" placement="bottom-end">
      <template #trigger="{ open, toggle, linkPopover }">
        <span :ref="linkPopover" class="source-candidate-reference">
          <button
            ref="trigger"
            type="button"
            class="source-candidate-trigger"
            :style="sourceSelectionInvalid ? { color: '#dc2626' } : undefined"
            :title="title"
            :aria-label="title"
            :aria-expanded="open"
            aria-haspopup="dialog"
            :disabled="handleDiff.loading || !visible"
            @click.stop="toggle"
          >
            <MSvg name="exchange" size-16px />
          </button>
        </span>
      </template>
      <div
        class="source-candidate-panel"
        :style="{ '--source-max-width': `${Math.max(0, inputWidth - 2)}px` }"
        role="dialog"
        aria-label="Choose source"
      >
        <p
          v-if="sourceSelectionInvalid"
          m-0
          px-12px
          py-8px
          text-13px
          text-red-600
        >
          The source in this link does not match this API. Choose a source
          below.
        </p>
        <button
          v-for="candidate in sourceCandidates"
          :key="candidate.filePath + candidate.targetPaths.join('.')"
          type="button"
          class="source-candidate-option"
          :class="{
            'bg-blue-50 text-blue-600':
              candidate.filePath === searchFromData.filePath,
          }"
          :aria-pressed="candidate.filePath === searchFromData.filePath"
          :disabled="handleDiff.loading"
          @click="select(candidate.filePath)"
        >
          <span class="source-candidate-check" aria-hidden="true">{{
            candidate.filePath === searchFromData.filePath ? '✓' : ''
          }}</span>
          <span min-w-0 flex-1>
            <span class="source-candidate-path">{{ candidate.filePath }}</span>
          </span>
        </button>
      </div>
    </MPopover>
  </div>
</template>

<style scoped>
.source-candidate-anchor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.source-candidate-reference {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  height: 100%;
  padding-right: 4px;
  box-sizing: border-box;
}
.source-candidate-trigger {
  pointer-events: auto;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.source-candidate-trigger:hover {
  background: #f3f4f6;
}
.source-candidate-trigger:disabled {
  opacity: 0.4;
  cursor: default;
}
.source-candidate-panel {
  pointer-events: auto;
  width: max-content;
  min-width: min(280px, var(--source-max-width));
  max-width: var(--source-max-width);
  max-height: min(360px, calc(100vh - 16px));
  overflow: auto;
  padding: 4px;
  box-sizing: border-box;
}
.source-candidate-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: max-content;
  padding: 8px;
  text-align: left;
  font: inherit;
  font-size: 13px;
  border: 0;
  border-radius: 4px;
  background-color: transparent;
  cursor: pointer;
}
.source-candidate-option[aria-pressed='true'] {
  background: #eff6ff;
  color: #2563eb;
}
.source-candidate-option:hover {
  background: #f3f4f6;
}
.source-candidate-option:disabled {
  cursor: default;
  opacity: 0.5;
}
.source-candidate-check {
  width: 16px;
  flex-shrink: 0;
}
.source-candidate-path {
  white-space: nowrap;
}
</style>
