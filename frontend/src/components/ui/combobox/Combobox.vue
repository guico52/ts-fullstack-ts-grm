<script setup lang="ts">
/**
 * A dropdown that behaves like one.
 *
 * `NativeSelect` was a `<select>` wearing the input's classes: it opened the
 * OS menu, could not be searched, and could not show a hint next to an
 * option. This is a trigger plus a popover — the trigger looks like a control
 * (not like a text field), and the list is ours, so options can carry an
 * icon, a secondary line (a route, a code) and still be filtered by typing.
 *
 * Built on the same Popover primitive as everything else, so focus return,
 * Escape and click-outside come from Reka rather than from hand-rolled
 * listeners.
 */
import type { Component } from "vue"
import { computed, ref, watch } from "vue"
import { Check, ChevronsUpDown, X } from "@lucide/vue"

import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface ComboboxOption {
  value: string
  label: string
  /** Secondary text, right-aligned and mono — a route, a code, a type. */
  hint?: string
  /** Leading glyph. */
  icon?: Component
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: readonly ComboboxOption[]
    /** Shown on the trigger while nothing is selected. */
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    id?: string
    invalid?: boolean
    /** Offer a row that clears the selection — for fields that may be empty. */
    clearable?: boolean
  }>(),
  {
    placeholder: "请选择…",
    searchPlaceholder: "搜索…",
    emptyText: "没有匹配项。",
    clearable: false,
  },
)

const emit = defineEmits<{ "update:modelValue": [string] }>()

const open = ref(false)
const query = ref("")

const selected = computed(() => props.options.find((option) => option.value === props.modelValue))

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle === "") return props.options
  return props.options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      (option.hint ?? "").toLowerCase().includes(needle),
  )
})

function choose(value: string): void {
  emit("update:modelValue", value)
  open.value = false
}

// A stale query would filter the next opening down to nothing.
watch(open, (isOpen) => {
  if (isOpen) query.value = ""
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        :id="id"
        type="button"
        role="combobox"
        :aria-expanded="open"
        :aria-invalid="invalid || undefined"
        :class="
          cn(
            'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none hover:bg-accent/40 focus-visible:ring-3',
          )
        "
      >
        <span class="flex min-w-0 items-center gap-2">
          <component :is="selected?.icon" v-if="selected?.icon" class="size-4 shrink-0" />
          <span :class="cn('truncate', selected ? '' : 'text-muted-foreground')">
            {{ selected?.label ?? placeholder }}
          </span>
        </span>
        <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>

    <!-- Width follows the trigger so the list lines up with the control it
         belongs to, instead of floating at some unrelated width. -->
    <PopoverContent
      class="w-(--reka-popover-trigger-width) min-w-56 p-0"
      align="start"
      :side-offset="4"
    >
      <div class="border-b border-border/60 p-2">
        <Input v-model="query" :placeholder="searchPlaceholder" class="h-8" />
      </div>

      <div class="max-h-64 overflow-y-auto p-1">
        <button
          v-if="clearable && modelValue !== ''"
          type="button"
          class="text-muted-foreground hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
          @click="choose('')"
        >
          <X class="size-4 shrink-0" />
          清除选择
        </button>

        <button
          v-for="option in filtered"
          :key="option.value"
          type="button"
          :aria-selected="option.value === modelValue"
          :class="
            cn(
              'hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
              option.value === modelValue && 'bg-primary/10 text-primary',
            )
          "
          @click="choose(option.value)"
        >
          <component :is="option.icon" v-if="option.icon" class="size-4 shrink-0" />
          <span class="min-w-0 truncate">{{ option.label }}</span>
          <span v-if="option.hint" class="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
            {{ option.hint }}
          </span>
          <Check v-if="option.value === modelValue" class="size-4 shrink-0" />
        </button>

        <p v-if="filtered.length === 0" class="text-muted-foreground px-2 py-6 text-center text-sm">
          {{ emptyText }}
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>
