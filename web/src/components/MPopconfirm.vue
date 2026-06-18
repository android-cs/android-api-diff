<script setup lang="ts">
import MPopover from '@/components/MPopover.vue';

type PopconfirmPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left';

withDefaults(
  defineProps<{
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    placement?: PopconfirmPlacement;
  }>(),
  {
    title: 'Are you sure?',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    placement: 'bottom-end',
  },
);

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const handleConfirm = (close: () => void) => {
  emit('confirm');
  close();
};

const handleCancel = (close: () => void) => {
  emit('cancel');
  close();
};
</script>

<template>
  <MPopover :placement="placement" :offset="8" class="min-w-220px">
    <template #trigger="{ open, close, toggle, linkPopover }">
      <slot
        name="trigger"
        :open="open"
        :close="close"
        :toggle="toggle"
        :link-popover="linkPopover"
      />
    </template>
    <template #default="{ close }">
      <div p-10px @click.stop>
        <div text-gray-900 text-14px font-600 leading-20px whitespace-nowrap>
          {{ title }}
        </div>
        <div
          v-if="message"
          max-w-260px
          mt-4px
          text-gray-600
          text-12px
          leading-18px
        >
          {{ message }}
        </div>
        <div flex justify-end gap-8px mt-12px>
          <div
            h-26px
            box-border
            px-10px
            b-1px
            b-solid
            b-gray-200
            rounded-4px
            bg-white
            text-gray-700
            text-12px
            leading-24px
            cursor-pointer
            transition-colors
            hover="b-gray-400 bg-gray-50"
            @click="handleCancel(close)"
          >
            {{ cancelText }}
          </div>
          <div
            h-26px
            box-border
            px-10px
            b-1px
            b-solid
            b-red-500
            rounded-4px
            bg-red-500
            text-white
            text-12px
            leading-24px
            cursor-pointer
            transition-colors
            hover="b-red-600 bg-red-600"
            @click="handleConfirm(close)"
          >
            {{ confirmText }}
          </div>
        </div>
      </div>
    </template>
  </MPopover>
</template>
