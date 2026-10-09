<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

/**
 * The drag handle (when the dialog is draggable) is wired up by
 * `DialogContent` itself, which finds this element by `data-slot`: slot
 * content cannot see the dialog's `provide`.
 */
const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="dialog-header"
    :class="cn('flex flex-col gap-2 text-center sm:text-left', props.class)"
  >
    <slot />
  </div>
</template>
