<script setup lang="ts">
import type { SelectRootEmits } from "reka-ui"
import { computed } from "vue"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "@lucide/vue"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAGE_SIZES, isEllipsis, pageWindow, type PageSize } from "@/lib/pagination"

/**
 * The paginator every table in this app uses.
 *
 * It is a primitive, not a policy: it renders the state it is handed and
 * emits what changed. The clamping that keeps a stale page from emptying
 * the table lives in lib/pagination.ts, where it is tested without a DOM.
 *
 * The "Showing 11–20 of 42" line is not decoration. Without it a filtered
 * table and a truncated one look identical, and the user cannot tell
 * whether they are seeing everything.
 */
const props = defineProps<{
  page: number
  pageSize: number
  pageCount: number
  total: number
  from: number
  to: number
}>()

const emit = defineEmits<{
  "update:page": [number]
  "update:pageSize": [PageSize]
}>()

const window = computed(() => pageWindow(props.page, props.pageCount))

const canGoBack = computed(() => props.page > 1)
const canGoForward = computed(() => props.page < props.pageCount)

function onPageSize(value: SelectRootEmits["update:modelValue"][0]) {
  const size = PAGE_SIZES.find((size) => size === Number(value))
  if (size !== undefined) emit("update:pageSize", size)
}
</script>

<template>
  <div
    class="flex flex-col gap-3 border-t border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <!-- tabular-nums so the range does not jitter as the digits change. -->
    <p class="text-xs text-muted-foreground tabular-nums">
      显示
      <span class="font-medium text-foreground">{{ from }}</span>
      –
      <span class="font-medium text-foreground">{{ to }}</span>
      ，共
      <span class="font-medium text-foreground">{{ total }}</span>
      条
    </p>

    <div class="flex items-center justify-between gap-2 sm:justify-end">
      <div class="hidden items-center gap-2 sm:flex">
        <span class="text-xs text-muted-foreground">每页</span>
        <Select :model-value="String(pageSize)" @update:model-value="onPageSize">
          <SelectTrigger class="h-8 w-[4.25rem] text-xs tabular-nums" aria-label="每页条数">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="String(size)">
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <nav aria-label="分页" class="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          :disabled="!canGoBack"
          aria-label="上一页"
          @click="emit('update:page', page - 1)"
        >
          <ChevronLeft class="size-4" />
        </Button>

        <!--
          Narrow screens get a position readout instead of a number strip:
          six page buttons plus two arrows do not fit, and a horizontally
          scrolling pager hides the control it is trying to offer.
        -->
        <span class="px-2 text-xs text-muted-foreground tabular-nums sm:hidden">
          第 {{ page }} / {{ pageCount }} 页
        </span>

        <div class="hidden items-center gap-1 sm:flex">
          <template v-for="(entry, index) in window" :key="`${entry}-${index}`">
            <span
              v-if="isEllipsis(entry)"
              class="flex size-8 items-center justify-center text-muted-foreground"
              aria-hidden="true"
            >
              <MoreHorizontal class="size-4" />
            </span>
            <Button
              v-else
              :variant="entry === page ? 'default' : 'ghost'"
              size="icon-sm"
              class="tabular-nums"
              :aria-label="`第 ${entry} 页`"
              :aria-current="entry === page ? 'page' : undefined"
              @click="emit('update:page', entry)"
            >
              {{ entry }}
            </Button>
          </template>
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          :disabled="!canGoForward"
          aria-label="下一页"
          @click="emit('update:page', page + 1)"
        >
          <ChevronRight class="size-4" />
        </Button>
      </nav>
    </div>
  </div>
</template>
