<script setup lang="ts">
/**
 * Multi-select whose options are a tree.
 *
 * The plain multi-select would have been enough if the ids were a flat set —
 * but a role grants *pages*, and a page only means something under its menu.
 * A flat list of 组织管理 / 用户管理 / 系统管理 reads as three peers; the same
 * three indented under 系统管理 read as what they are.
 *
 * Searching keeps the hierarchy: a match is shown together with its
 * ancestors, never as an orphan. Filtering to a bare list of hits would throw
 * away the one thing this control exists to show.
 */
import { computed, ref, watch } from "vue"
import { ChevronRight, ChevronsUpDown } from "@lucide/vue"

import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { flattenVisible, parentIds, type ViewTreeRow } from "@/lib/view-tree"

interface TreeSelectOption {
  value: string
  label: string
  /** Parent option, or null/absent for a root. */
  parentId?: string | null
  sort?: number
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: readonly TreeSelectOption[]
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
const collapsed = ref<Set<string>>(new Set())

const byId = computed(() => new Map(props.options.map((option) => [option.value, option])))

/** The options to render: everything, or a match plus the path down to it. */
const visibleOptions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle === "") return props.options

  const keep = new Set<string>()
  for (const option of props.options) {
    if (!option.label.toLowerCase().includes(needle)) continue
    // Self, then every ancestor — so the hit keeps its place in the tree.
    let current: TreeSelectOption | undefined = option
    while (current) {
      keep.add(current.value)
      const up: string | null = current.parentId ?? null
      current = up === null ? undefined : byId.value.get(up)
    }
  }
  return props.options.filter((option) => keep.has(option.value))
})

const rows = computed<ViewTreeRow[]>(() =>
  visibleOptions.value.map((option) => ({
    id: option.value,
    parentId: option.parentId ?? null,
    sort: option.sort ?? 0,
  })),
)

const expanded = computed(() => {
  const openIds = parentIds(rows.value)
  // While searching, everything relevant is already visible; collapsing a
  // branch would hide the match that put it there.
  if (query.value.trim() !== "") return openIds
  for (const id of collapsed.value) openIds.delete(id)
  return openIds
})

const lines = computed(() => flattenVisible(rows.value, expanded.value))

const selected = computed(() =>
  props.options.filter((option) => props.modelValue.includes(option.value)),
)

function toggle(value: string): void {
  emit(
    "update:modelValue",
    props.modelValue.includes(value)
      ? props.modelValue.filter((item) => item !== value)
      : [...props.modelValue, value],
  )
}

function toggleExpand(id: string): void {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

function clearAll(): void {
  emit("update:modelValue", [])
}

watch(open, (isOpen) => {
  if (isOpen) {
    query.value = ""
    collapsed.value = new Set()
  }
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

      <div class="max-h-72 overflow-y-auto p-1">
        <div
          v-for="line in lines"
          :key="String(line.row.id)"
          data-slot="tree-select-option"
          class="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
          @click="toggle(String(line.row.id))"
        >
          <!-- Indentation is the hierarchy; the arrow is only for branches. -->
          <span
            class="flex shrink-0 items-center"
            :style="{ paddingLeft: `${line.depth * 0.9}rem` }"
          >
            <button
              v-if="line.hasChildren"
              type="button"
              class="text-muted-foreground hover:text-foreground flex size-4 cursor-pointer items-center justify-center rounded"
              :aria-label="line.expanded ? '折叠' : '展开'"
              :aria-expanded="line.expanded"
              @click.stop="toggleExpand(String(line.row.id))"
            >
              <ChevronRight
                class="size-3.5 transition-transform"
                :class="line.expanded ? 'rotate-90' : ''"
              />
            </button>
            <span v-else class="size-4" aria-hidden="true" />
          </span>

          <span
            :class="
              cn(
                'flex size-4 shrink-0 items-center justify-center rounded border',
                modelValue.includes(String(line.row.id))
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-input',
              )
            "
          >
            <span v-if="modelValue.includes(String(line.row.id))" class="text-xs leading-none">
              ✓
            </span>
          </span>

          <span class="min-w-0 truncate">
            {{ byId.get(String(line.row.id))?.label ?? line.row.id }}
          </span>
        </div>

        <p v-if="lines.length === 0" class="text-muted-foreground px-2 py-6 text-center text-sm">
          {{ emptyText }}
        </p>
      </div>
    </PopoverContent>
  </Popover>
</template>
