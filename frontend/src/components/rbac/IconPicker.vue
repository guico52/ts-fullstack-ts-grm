<script setup lang="ts">
import { computed, ref } from "vue"

import { Input } from "@/components/ui/input"
import { ICON_GROUPS } from "@/config/icons"
import { cn } from "@/lib/utils"

/**
 * Pick an icon instead of typing one.
 *
 * A free-text icon field is a field that accepts `Building2`, `building2` and
 * `Bulding2` equally, and only one of those renders. Choosing from a grid
 * removes the whole class of mistake — and the "which icons exist?" question
 * disappears with it.
 *
 * The catalogue is `config/icons.ts`, which is the only place that knows
 * where icons come from.
 */
const props = defineProps<{ modelValue: string; id?: string }>()
const emit = defineEmits<{ "update:modelValue": [string] }>()

const query = ref("")

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return ICON_GROUPS.flatMap((group) =>
    Object.entries(group.icons)
      .filter(([name]) => needle === "" || name.toLowerCase().includes(needle))
      .map(([name, icon]) => ({ group: group.label, name, icon })),
  )
})

/** The chosen icon, looked up across every group. */
const current = computed(() => {
  for (const group of ICON_GROUPS) {
    const icon = group.icons[props.modelValue]
    if (icon) return icon
  }
  return undefined
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 rounded-md border border-input px-3 py-2">
      <component :is="current" v-if="current" class="size-4 shrink-0" />
      <span class="font-mono text-xs" :class="current ? '' : 'text-muted-foreground'">
        {{ current ? modelValue : "未选择图标" }}
      </span>
    </div>

    <Input :id="id" v-model="query" placeholder="搜索图标名，例如 users…" />

    <div class="max-h-52 overflow-auto rounded-md border border-input p-1">
      <div class="grid grid-cols-3 gap-1 sm:grid-cols-4">
        <button
          v-for="entry in matches"
          :key="`${entry.group}/${entry.name}`"
          type="button"
          :title="entry.name"
          :aria-pressed="entry.name === modelValue"
          :class="
            cn(
              'flex cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-2 hover:bg-accent',
              entry.name === modelValue && 'bg-primary/10 text-primary ring-1 ring-primary/40',
            )
          "
          @click="emit('update:modelValue', entry.name)"
        >
          <component :is="entry.icon" class="size-4" />
          <span class="w-full truncate text-center font-mono text-xs">{{ entry.name }}</span>
        </button>
      </div>
      <p v-if="matches.length === 0" class="px-2 py-6 text-center text-sm text-muted-foreground">
        没有匹配的图标。
      </p>
    </div>
  </div>
</template>
