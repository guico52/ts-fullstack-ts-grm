<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { X } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from "reka-ui"
import { useDraggableDialog } from "@/composables/useDraggableDialog"
import { cn } from "@/lib/utils"
import { DIALOG_SIZES, type DialogSize } from "@/lib/dialog-sizes"
import DialogOverlay from "./DialogOverlay.vue"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes["class"]
      showCloseButton?: boolean
      /** Drag the dialog by its header. Off by default. */
      draggable?: boolean
      /**
       * Width class. `md` is a single-column form; a dialog whose fields pair
       * up wants `xl`, because two half-width inputs in 512px come out
       * narrower than one full-width input would have been.
       */
      size?: DialogSize
    }
  >(),
  {
    showCloseButton: true,
    draggable: false,
    size: "md",
  },
)
const emits = defineEmits<DialogContentEmits>()

// `showCloseButton`, `draggable` and `size` are ours, not Reka's, so they
// must not reach the DOM: a literal `draggable` attribute would switch on the
// browser's own HTML5 drag on the panel.
const delegatedProps = reactiveOmit(props, "class", "showCloseButton", "draggable", "size")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

// The gesture listens on the panel element itself, which is also what it
// measures and moves — so `event.currentTarget` is all it needs.
const drag = useDraggableDialog(() => props.draggable)
const dragStyle = drag.style
const dragHandlers = drag.handlers
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      :data-draggable="props.draggable ? '' : undefined"
      :style="props.draggable ? dragStyle : undefined"
      v-bind="{ ...$attrs, ...forwarded }"
      v-on="props.draggable ? dragHandlers : {}"
      :class="
        cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200',
          DIALOG_SIZES[props.size],
          props.class,
        )
      "
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <X />
        <span class="sr-only">关闭</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>

<style>
/*
 * The handle is slotted content, so a scoped rule cannot reach it — hence a
 * plain `<style>` block. It is scoped by `[data-draggable]` instead, which
 * only a draggable dialog carries.
 *
 * `touch-action: none` is load-bearing: without it a touch drag scrolls the
 * page instead of moving the dialog. `user-select: none` stops the gesture
 * from painting a text selection across the title.
 */
[data-draggable] [data-slot="dialog-header"] {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

[data-draggable] [data-slot="dialog-header"]:active {
  cursor: grabbing;
}

/*
 * The panel carries `transition: all 200ms` (from `duration-200`), which
 * would ease every step of a drag and leave the box trailing the pointer by
 * up to ~200px. Neither the centred position nor the drag itself is an
 * animation, so the transition is simply switched off while dragging.
 *
 * `will-change` promotes the panel for the duration of the gesture only —
 * a permanent hint on a rarely-moved element costs more than it saves.
 */
[data-draggable][data-dragging] {
  transition-property: none;
  will-change: translate;
}
</style>
