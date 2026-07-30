<script setup lang="ts" generic="T extends MSelectValue">
import MPopover from '@/components/MPopover.vue';
import MSvg from '@/components/MSvg.vue';
import { provide, ref, type Ref } from 'vue';
import { M_SELECT_CONTEXT_KEY, type MSelectValue } from './MSelect.context.ts';

type SelectPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left';

const props = withDefaults(
  defineProps<{
    label?: string;
    placement?: SelectPlacement;
    offset?: number;
    triggerMinWidth?: string;
    popoverMinWidth?: string;
    matchPopoverWidth?: boolean;
  }>(),
  {
    label: '',
    placement: 'bottom-start',
    offset: 6,
    triggerMinWidth: 'auto',
    popoverMinWidth: 'auto',
    matchPopoverWidth: false,
  },
);

const model = defineModel<T>({
  required: true,
});

const popoverRef = ref<InstanceType<typeof MPopover>>();

const isSelected = (value: MSelectValue) => Object.is(model.value, value);

const selectValue = (value: MSelectValue) => {
  model.value = value as T;
  void popoverRef.value?.close();
};

provide(M_SELECT_CONTEXT_KEY, {
  modelValue: model as Ref<MSelectValue>,
  isSelected,
  selectValue,
});
</script>

<template>
  <div flex items-center gap-6px text-14px text-gray-600>
    <span v-if="label" whitespace-nowrap>{{ label }}</span>
    <MPopover
      ref="popoverRef"
      :placement="placement"
      :offset="offset"
      :match-trigger-width="matchPopoverWidth"
      class="overflow-hidden"
    >
      <template #trigger="{ open, toggle, linkPopover }">
        <div
          :ref="linkPopover"
          h-28px
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
          gap-8px
          cursor-pointer
          select-none
          text-14px
          transition-colors
          hover="b-gray-400"
          :class="{
            'b-gray-400': open,
          }"
          :style="{ minWidth: props.triggerMinWidth }"
          role="button"
          aria-haspopup="listbox"
          :aria-expanded="open"
          @click.stop="toggle"
        >
          <span text-dark-100 font-500 whitespace-nowrap>
            <slot name="value" :value="model">{{ model }}</slot>
          </span>
          <MSvg
            name="expand-more"
            w-16px
            h-16px
            shrink-0
            text-gray-500
            transition-transform
            :class="{
              'rotate-180': open,
            }"
          />
        </div>
      </template>
      <template #default>
        <div
          max-h-240px
          overflow-y-auto
          py-2px
          role="listbox"
          :style="{ minWidth: props.popoverMinWidth }"
          @click.stop
        >
          <slot />
        </div>
      </template>
    </MPopover>
  </div>
</template>
