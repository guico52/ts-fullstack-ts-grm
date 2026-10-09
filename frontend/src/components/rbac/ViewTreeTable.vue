<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { ChevronRight, CirclePlus, FilePlus2, Loader2, Pencil, Trash2 } from "@lucide/vue"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { findIcon } from "@/config/icons"
import { columnClass, type ResourceColumn, type ResourceRow } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import { flattenVisible, parentIds, type ViewTreeRow } from "@/lib/view-tree"

/**
 * The view tree as a collapsible table.
 *
 * A flat list cannot show that a page belongs to a menu — the whole point of
 * the three levels — and a tree that opens fully expanded on a large menu is
 * unreadable. So: expand by default only where there is something to expand,
 * and remember what the user closed.
 *
 * It lives here rather than in the page because the page keeps a plain table
 * plus `DataPagination` for every other resource; a tree has no page number
 * to go to, so paging it would be a control that lies.
 */
const props = defineProps<{
  actions: { create: boolean; update: boolean; delete: boolean }
  columns: readonly ResourceColumn[]
  rows: readonly ResourceRow[]
  loading?: boolean
  /** The row whose delete is in flight, so its button can say so. */
  pendingRemoveId?: string | null
}>()

const emit = defineEmits<{
  edit: [ResourceRow]
  remove: [ResourceRow]
  /** Add a child of this row — a page under a menu, a button under a page. */
  addChild: [ResourceRow]
}>()

/**
 * What a row can contain, or null at the bottom of the tree.
 *
 * The icon differs per level on purpose: 添加页面 and 添加按钮 are different
 * actions, and two identical ⊕ glyphs in the same column would be a guess.
 */
function childKind(row: ResourceRow): { label: string; icon: typeof FilePlus2 } | null {
  if (row.type === "MENU") return { label: "页面", icon: FilePlus2 }
  if (row.type === "VIEW") return { label: "按钮", icon: CirclePlus }
  return null
}

/**
 * The glyph carries the level's colour, and **only** the glyph does.
 *
 * Hovering a row paints its background and nothing else — a muted icon that
 * brightens on hover reads as a control, and these icons are not clickable.
 */
function iconTone(row: ResourceRow): string {
  if (row.type === "MENU") return "text-primary"
  if (row.type === "VIEW") return "text-chart-1"
  return "text-muted-foreground"
}

/** Nothing is remembered across loads; children of a freshly loaded tree open. */
const collapsed = ref<Set<string>>(new Set())

const treeRows = computed(() => props.rows as ViewTreeRow[])
const expanded = computed(() => {
  const open = parentIds(treeRows.value)
  for (const id of collapsed.value) open.delete(id)
  return open
})
const lines = computed(() =>
  flattenVisible(treeRows.value, expanded.value).map((line) => ({
    ...line,
    child: childKind(line.row),
    iconTone: iconTone(line.row),
    // Resolved once per render rather than three times in the template.
    cells: props.columns.map((column) => ({
      column,
      text: column.value(line.row),
      badge: column.badge?.(line.row) ?? null,
    })),
  })),
)

// A new set of rows has its own ids; keeping the old collapse state would
// hide rows the user has never seen.
watch(
  () => props.rows,
  () => {
    collapsed.value = new Set()
  },
)

function toggle(id: string): void {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}
</script>

<template>
  <div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-for="column in columns" :key="column.key" :class="columnClass(column)">
            {{ column.label }}
          </TableHead>
          <TableHead class="w-20"><span class="sr-only">操作</span></TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        <TableRow v-for="line in lines" :key="String(line.row.id)">
          <TableCell
            v-for="(cell, index) in line.cells"
            :key="cell.column.key"
            :class="columnClass(cell.column)"
          >
            <!-- The first column carries the hierarchy: indent by depth, and
                 an expander only where there is something to expand. -->
            <div
              v-if="index === 0"
              class="flex min-w-0 items-center gap-1"
              :style="{ paddingLeft: `${line.depth * 1.25}rem` }"
            >
              <button
                v-if="line.hasChildren"
                type="button"
                class="text-muted-foreground hover:text-foreground -ml-1 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded"
                :aria-expanded="line.expanded"
                :aria-label="line.expanded ? '折叠' : '展开'"
                @click="toggle(String(line.row.id))"
              >
                <ChevronRight
                  class="size-4 transition-transform"
                  :class="line.expanded ? 'rotate-90' : ''"
                />
              </button>
              <span v-else class="size-5 shrink-0" aria-hidden="true" />

              <component
                :is="findIcon(line.row.icon)"
                v-if="findIcon(line.row.icon)"
                :class="cn('size-4 shrink-0', line.iconTone)"
              />
              <span class="truncate font-medium">{{ cell.text }}</span>
            </div>

            <!-- Kind and status read faster as labels than as words in a column. -->
            <Badge
              v-else-if="cell.badge"
              variant="outline"
              :class="cn('border-transparent', cell.badge.tone)"
            >
              {{ cell.badge.label }}
            </Badge>

            <template v-else>{{ cell.text }}</template>
          </TableCell>

          <TableCell>
            <div class="flex items-center justify-end gap-1">
              <!-- Add is offered only where the tree has another level below;
                   a button is a leaf, so it gets no ⊕. -->
              <Tooltip v-if="line.child && actions.create">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-chart-4 hover:bg-chart-4/12 hover:text-chart-4"
                    :aria-label="`为「${line.row.name}」添加${line.child.label}`"
                    @click="emit('addChild', line.row)"
                  >
                    <component :is="line.child.icon" class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>添加{{ line.child.label }}</TooltipContent>
              </Tooltip>

              <Tooltip v-if="actions.update">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-chart-1 hover:bg-chart-1/12 hover:text-chart-1"
                    :aria-label="`编辑 ${line.row.name}`"
                    @click="emit('edit', line.row)"
                  >
                    <Pencil class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>编辑</TooltipContent>
              </Tooltip>

              <Tooltip v-if="actions.delete">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    :disabled="pendingRemoveId === String(line.row.id)"
                    :aria-label="`删除 ${line.row.name}`"
                    @click="emit('remove', line.row)"
                  >
                    <Loader2
                      v-if="pendingRemoveId === String(line.row.id)"
                      class="size-4 animate-spin"
                    />
                    <Trash2 v-else class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除</TooltipContent>
              </Tooltip>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <p v-if="lines.length === 0" class="text-muted-foreground px-6 py-12 text-center text-sm">
      {{ loading ? "加载中…" : "还没有视图。" }}
    </p>
  </div>
</template>
