<script setup lang="ts">
/**
 * Standard page chrome: the route's one <h1> (+ optional meta chip), a
 * muted subtitle, and actions on the right that wrap beneath on narrow
 * screens.
 *
 * Every view uses this. The design-system guard enforces it, because a
 * page that invents its own heading level or size is the fastest way for
 * an admin app to stop looking like one app.
 *
 * Typography: 20px / weight 650 / -0.01em tracking. The tight tracking is
 * what keeps a heading this size from looking loose next to 14px body text.
 */
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="flex min-w-0 flex-wrap items-start justify-between gap-3">
    <div class="min-w-0 space-y-1">
      <div class="flex min-w-0 flex-wrap items-center gap-3">
        <h1 class="min-w-0 text-xl font-[650] tracking-[-0.01em] break-words">{{ title }}</h1>
        <slot name="meta" />
      </div>
      <p v-if="subtitle" class="text-sm text-muted-foreground">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex min-w-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
