<script setup lang="ts">
import { Button } from "@/components/ui/button"

/**
 * A dismissible failure notice for a row action.
 *
 * Row actions fire from a dialog or a button, both of which are gone by the
 * time the request resolves — so a failure has nowhere of its own to show.
 * This is the place: above the table, where the row it refers to still is.
 *
 * `role="alert"` so it is announced rather than merely drawn: a delete that
 * silently did nothing is worse than one that says it failed.
 */
defineProps<{ message: string | null }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div
    v-if="message"
    role="alert"
    class="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
  >
    <span>{{ message }}</span>
    <Button variant="ghost" size="xs" class="shrink-0" @click="$emit('dismiss')"> 关闭 </Button>
  </div>
</template>
