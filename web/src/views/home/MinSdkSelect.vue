<script setup lang="ts">
import MOption from '@/components/MOption.vue';
import MSelect from '@/components/MSelect.vue';
import { androidVersionInfos } from '@/utils/constants';
import { computed } from 'vue';
import { useSharedHomeState } from './homeState';

const { minSdk, minSdkOptions } = useSharedHomeState();

const minSdkItems = computed(() =>
  minSdkOptions.map((sdk) => ({
    sdk,
    versionInfo: androidVersionInfos.find((v) => v.apiVersion === sdk),
  })),
);
</script>

<template>
  <MSelect
    v-model="minSdk"
    label="minSdk"
    trigger-min-width="56px"
    popover-min-width="240px"
  >
    <MOption v-for="item in minSdkItems" :key="item.sdk" :value="item.sdk">
      <template #default="{ selected }">
        <span w-24px text-right>{{ item.sdk }}</span>
        <span w-36px text-left>{{ item.versionInfo?.version }}</span>
        <span
          min-w-0
          flex-1
          text-12px
          text-left
          whitespace-nowrap
          :class="selected ? 'text-blue-500' : 'text-gray-500'"
          >{{ item.versionInfo?.alias }}</span
        >
      </template>
    </MOption>
  </MSelect>
</template>
