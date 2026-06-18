<script setup lang="ts">
import {
  getGoogleSourceUrl,
  getMirrorContentUrl,
  getSourceUrlWithLine,
} from '@/utils/url';
import { computed } from 'vue';
import { ANDROID_PREFIX_LEN, useSharedHomeState } from './homeState';

const props = defineProps<{
  tag: string;
  future?: boolean;
}>();

const { urlBuilder, getDiffResult, searchFromData, sourceLinkTarget } =
  useSharedHomeState();
const diffResult = computed(() => getDiffResult(props.tag));

const title = computed<string | undefined>(() => {
  if (props.future) {
    return 'Future Tag (Not in GitHub Releases)';
  }
  const d = diffResult.value;
  if (!d) return;
  if (d.typeDesc) return d.typeDesc;
  if (d.notFound) return `Not Found File`;
  if (searchFromData.value.targetKind === 'file') return 'Found File';
  if (searchFromData.value.targetKind === 'class') {
    return d.target ? 'Found Class' : 'Not Found Class';
  }
  if (!d.target) return 'Not Found Class';
  return 'Not Found Prop';
});
const notFound = computed(() => diffResult.value?.notFound);
const sourceUrl = computed<string | undefined>(() => {
  const builder = urlBuilder.value;
  if (!builder) return '';
  const t = builder.templateUrl;
  const loc = (() => {
    if (searchFromData.value.targetKind === 'member') {
      return diffResult.value?.members?.[0]?.loc;
    }
    if (searchFromData.value.targetKind === 'class') {
      return diffResult.value?.target?.loc;
    }
  })();
  if (sourceLinkTarget.value === 'googlesource') {
    const u = getGoogleSourceUrl(props.tag + builder.filePath);
    return loc ? getSourceUrlWithLine(u, loc) : u;
  }
  if (sourceLinkTarget.value === 'githubusercontent') {
    return getMirrorContentUrl(props.tag + builder.filePath);
  }
  const u = t[0] + props.tag + t[1];
  if (loc) {
    return getSourceUrlWithLine(u, loc);
  }
  return u;
});
const tagColor = computed(() => {
  if (props.future) {
    return 'linear-gradient(90deg,rgba(42, 123, 155, 1) 0%, rgba(87, 199, 133, 1) 50%, rgba(237, 221, 83, 1) 100%)';
  }
  return diffResult.value?.typeColor;
});

const tagName = computed(() => {
  return props.tag.substring(ANDROID_PREFIX_LEN);
});
</script>
<template>
  <div class="TagCard" flex gap-4px items-center>
    <div
      size-12px
      transition-colors
      :title="title"
      :style="{
        background: tagColor || '#00000040',
      }"
    ></div>
    <a
      v-if="urlBuilder && !notFound"
      :href="sourceUrl"
      target="_blank"
      transition-colors
      hover="color-[rgb(from_currentColor_r_g_b_/_50%)]"
      whitespace-nowrap
    >
      {{ tagName }}
    </a>
    <a
      v-else
      whitespace-nowrap
      transition-colors
      :style="{
        color: tagColor,
      }"
    >
      {{ tagName }}
    </a>
  </div>
</template>
