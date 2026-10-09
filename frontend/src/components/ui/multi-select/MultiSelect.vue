<script setup lang="ts">
/**
 * Multi-select dropdown.
 *
 * The single-select `Combobox` and this differ in exactly two behaviours —
 * the value is a list, and picking one does not close the popover — so they
 * are separate components rather than one component with a `multiple` flag:
 * a flag would make every prop and every emit site a union type for no gain.
 * The trigger, the search box and the option row are kept deliberately
 * identical, so the two read as one control in two moods.
 */
import type { Component } from "vue"
import { computed, ref, watch } from "vue"
import { Check, ChevronsUpDown } from "@lucide/vue"

import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MultiSelectOption {
  value: string
  label: string
  /** Secondary text, right-aligned and mono — a route, a code, a type. */
  hint?: string
  icon?: Component
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: readonly MultiSelectOption[]
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    id?: string
    invalid?: boolean
  }>(),
  {
    placeholder: "选择…",
    searchPlaceholder: "搜索…",
    emptyText: "没有匹配项。",
  },
)

const emit = defineEmits<{ "update:modelValue": [string[]] }>()

const open = ref(false)
const query = ref("")

const selected = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle === "") return props.options
  return props.options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) ||
      (option.hint ?? "").toLowerCase().includes(needle),
  )
})

function toggle(value: string): void {
  emit(
    "update:modelValue",
    props.modelValue.includes(value)
      ? props.modelValue.filter((item) => item !== value)
      : [...props.modelValue, value],
  )
}

function clearAll(): void {
  emit("update:modelValue", [])
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
            'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive flex min-h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none hover:bg-accent/40 focus-visible:ring-3',
          )
        "
      >
        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <!-- The chosen items are shown as chips: a count would hide *which*
               ones, and that is the question the field is answering. -->
          <template v-if="selected.length > 0">
            <span
              v-for="item in selected"
              :key="item.value"
              class="bg-secondary text-secondary-foreground inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs"
            >
              <span class="truncate">{{ item.label }}</span>
            </span>
          </template>
          <span v-else class="text-muted-foreground">{{ placeholder }}</span>
        </span>
        <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>

    <PopoverContent
      class="w-(--reka-popover-trigger-width) min-w-56 p-0"
      align="start"
      :side-offset="4"
    >
      <div class="flex items-center gap-2 border-b border-border/60 p-2">
        <Input v-model="query" :placeholder="searchPlaceholder" class="h-8" />
        <button
          v-if="modelValue.length > 0"
          type="button"
          class="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded px-2 py-1 text-xs"
          @click="clearAll"
        >
          清空
        </button>
      </div>

      <div class="max-h-64 overflow-y-auto p-1">
        <button
          v-for="option in filtered"
          :key="option.value"
          type="button"
          role="option"
          data-slot="multi-select-option"
          :aria-selected="modelValue.includes(option.value)"
          :class="
            cn(
              'hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
            )
          "
          @click="toggle(option.value)"
        >
          <span
            :class="
              cn(
                'flex size-4 shrink-0 items-center justify-center rounded border',
                modelValue.includes(option.value)
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-input',
              )
            "
          >
            <Check v-if="modelValue.includes(option.value)" class="size-3" />
          </span>
          <component :is="option.icon" v-if="option.icon" class="size-4 shrink-0" />
          <span class="min-w-0 truncate">{{ option.label }}</span>
          <span v-if="option.hint" class="text-muted-foreground ml-auto shrink-0 font-mono text-xs">
            {{ option.hint }}
          </span>
        </button>

        <p v-if="filtered.length === 0" class="text-muted-foreground px-2 py-6 text-center text-sm">
          {{ emptyText }}
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>
