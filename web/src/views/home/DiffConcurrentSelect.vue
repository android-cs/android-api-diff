<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue';
import { useEventListener } from '@vueuse/core';
import { ref } from 'vue';
import { useSharedHomeState } from './homeState';

const { diffConcurrentCount, diffConcurrentCountOptions } =
  useSharedHomeState();

const isPanelOpen = ref(false);

const togglePanel = () => {
  isPanelOpen.value = !isPanelOpen.value;
};

const selectCount = (count: number) => {
  diffConcurrentCount.value = count;
  isPanelOpen.value = false;
};

useEventListener(window, 'click', () => {
  isPanelOpen.value = false;
});
</script>

<template>
  <div relative flex items-center gap-6px text-14px text-gray-600>
    <div>Concurrency</div>
    <div
      h-28px
      min-w-52px
      box-border
      b-1px
      b-solid
      b-gray-200
      rounded-4px
      bg-white
      px-8px
      flex
      items-center
      justify-between
      gap-4px
      cursor-pointer
      select-none
      text-dark-100
      hover="b-gray-400"
      @click.stop="togglePanel"
    >
      <div>{{ diffConcurrentCount }}</div>
      <SvgIcon name="expand-more" w-16px h-16px text-gray-500 />
    </div>
    <div
      v-if="isPanelOpen"
      absolute
      right-0
      z-20
      mt-4px
      min-w-52px
      bg-white
      b-1px
      b-solid
      b-gray-200
      rounded-4px
      shadow
      overflow-hidden
      style="top: 100%"
      @click.stop
    >
      <div
        v-for="count in diffConcurrentCountOptions"
        :key="count"
        px-8px
        py-4px
        cursor-pointer
        select-none
        text-dark-100
        hover="bg-gray-100"
        :class="{
          'bg-blue-50 text-blue-600': count === diffConcurrentCount,
        }"
        @click="selectCount(count)"
      >
        {{ count }}
      </div>
    </div>
  </div>
</template>
