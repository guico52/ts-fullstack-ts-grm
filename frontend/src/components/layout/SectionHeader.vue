<script setup lang="ts">
/**
 * Section divider: an uppercase tracked label plus a hairline rule that
 * takes the remaining width. Groups a page into readable bands without
 * adding another card or another border.
 */
</script>

<template>
  <div class="flex items-center gap-3">
    <h2 class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      <slot />
    </h2>
    <div class="h-px flex-1 bg-border/50" />
  </div>
</template>
