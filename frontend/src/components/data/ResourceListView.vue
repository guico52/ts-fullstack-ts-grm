<script setup lang="ts">
/**
 * The list page every resource shares.
 *
 * Eight resources meant eight copies of the same table, dialog and paginator
 * — identical down to the tooltips. A page is now its spec plus three API
 * calls; everything that is the same for all of them lives here.
 *
 * It owns the `PageHeader`, which is why a page using it does not import
 * `PageHeader` itself. That is also why `design-system.test.ts` accepts this
 * component in place of a direct import: the rule is "exactly one h1, owned
 * by PageHeader", and a page that hands the job to this file still satisfies
 * it. See the note next to that guard.
 *
 * Relation candidates are loaded here rather than in each page, because the
 * spec already says which fields have a `from` — a page cannot forget, and a
 * spec with no relation fields makes no request at all.
 */
import { onMounted, ref } from "vue"
import { Loader2, Pencil, Plus, Trash2 } from "@lucide/vue"

import ActionError from "@/components/data/ActionError.vue"
import DataPagination from "@/components/data/DataPagination.vue"
import PageHeader from "@/components/layout/PageHeader.vue"
import ResourceFormDialog from "@/components/rbac/ResourceFormDialog.vue"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useResource } from "@/composables/useResource.ts"
import { describeApiError } from "@/lib/api.ts"
import { loadFieldOptions } from "@/lib/field-options.ts"
import type { PageSize } from "@/lib/pagination"
import {
  columnClass,
  type FieldOption,
  type ResourceRow,
  type ResourceSpec,
} from "@/lib/resource.ts"

const props = defineProps<{
  actions: { create: boolean; update: boolean; delete: boolean }
  spec: ResourceSpec
  list: (query: {
    limit: number
    offset: number
  }) => Promise<{ rows: ResourceRow[]; total: number }>
  remove: (id: string) => Promise<void>
  /** Values from the form, already shaped by `toRequestBody`. */
  save: (body: Record<string, unknown>, id: string | null) => Promise<void>
  /** A tree asks for everything at once; a flat list takes the default. */
  pageSize?: PageSize
}>()

const { spec } = props

const {
  rows,
  total,
  page,
  pageSize,
  pageInfo,
  loading,
  error: loadError,
  load,
  remove: removeRow,
} = useResource<ResourceRow>(
  { list: props.list, remove: props.remove },
  props.pageSize === undefined ? {} : { pageSize: props.pageSize },
)

/** Relation candidates. A failure here does not block the list; the picker
 *  for that field opens empty instead. */
const options = ref<Record<string, FieldOption[]>>({})

onMounted(async () => {
  if (spec.fields.every((field) => field.from === undefined)) return
  try {
    options.value = await loadFieldOptions(spec)
  } catch {
    options.value = {}
  }
})

const formOpen = ref(false)
const editing = ref<ResourceRow | null>(null)
const pendingDelete = ref<ResourceRow | null>(null)
/** The row whose delete is in flight, so its button can say so. */
const pendingRemoveId = ref<string | null>(null)
const actionError = ref<string | null>(null)

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(row: ResourceRow) {
  editing.value = row
  formOpen.value = true
}

async function confirmDelete() {
  const target = pendingDelete.value
  // Close first, then await: holding the row here means clearing the dialog
  // state cannot orphan the id, and the dialog is not left on screen while
  // the request runs.
  pendingDelete.value = null
  if (!target) return

  const id = String(target.id)
  actionError.value = null
  pendingRemoveId.value = id
  try {
    await removeRow(id)
  } catch (cause) {
    // The dialog is gone by now, so a failure has to land where the row
    // still is.
    actionError.value = `删除「${spec.label(target)}」失败：${describeApiError(cause)}`
  } finally {
    pendingRemoveId.value = null
  }
}
</script>

<template>
  <div class="p-4 space-y-4">
    <PageHeader :title="spec.title">
      <template #actions>
        <Button v-if="actions.create" @click="openCreate">
          <Plus class="size-4" />
          新建{{ spec.singular }}
        </Button>
      </template>
    </PageHeader>

    <ActionError :message="actionError" @dismiss="actionError = null" />

    <Card>
      <CardHeader>
        <CardTitle
          class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase"
        >
          结果
        </CardTitle>
        <CardDescription>共 {{ total }} 条</CardDescription>
      </CardHeader>

      <CardContent class="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="column in spec.columns"
                :key="column.key"
                :class="columnClass(column)"
              >
                {{ column.label }}
              </TableHead>
              <TableHead v-if="actions.update || actions.delete" class="w-20"
                ><span class="sr-only">操作</span></TableHead
              >
            </TableRow>
          </TableHeader>

          <TableBody>
            <TableRow v-for="row in rows" :key="String(row.id)">
              <TableCell
                v-for="column in spec.columns"
                :key="column.key"
                :class="columnClass(column)"
              >
                {{ column.value(row) }}
              </TableCell>
              <TableCell v-if="actions.update || actions.delete">
                <div class="flex items-center justify-end gap-1">
                  <Tooltip v-if="actions.update">
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="text-chart-1 hover:bg-chart-1/12 hover:text-chart-1"
                        :aria-label="`编辑 ${spec.label(row)}`"
                        @click="openEdit(row)"
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
                        :disabled="pendingRemoveId === String(row.id)"
                        :aria-label="`删除 ${spec.label(row)}`"
                        @click="pendingDelete = row"
                      >
                        <Loader2
                          v-if="pendingRemoveId === String(row.id)"
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

        <div v-if="rows.length === 0" class="px-6 py-12 text-center">
          <p class="text-sm text-muted-foreground">
            {{ loading ? "加载中…" : (loadError ?? `还没有${spec.singular}。`) }}
          </p>
          <div v-if="!loading" class="mt-4 flex justify-center">
            <Button v-if="actions.create" @click="openCreate">
              <Plus class="size-4" />
              新建{{ spec.singular }}
            </Button>
          </div>
        </div>

        <DataPagination
          v-else
          :page="pageInfo.page"
          :page-size="pageInfo.pageSize"
          :page-count="pageInfo.pageCount"
          :total="pageInfo.total"
          :from="pageInfo.from"
          :to="pageInfo.to"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </CardContent>
    </Card>

    <ResourceFormDialog
      v-model:open="formOpen"
      :spec="spec"
      :record="editing"
      :options="options"
      :save="save"
      @saved="load"
    />

    <AlertDialog
      :open="pendingDelete !== null"
      @update:open="
        (open: boolean) => {
          if (!open) pendingDelete = null
        }
      "
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            删除「{{ pendingDelete ? spec.label(pendingDelete) : "" }}」？
          </AlertDialogTitle>
          <!-- 空描述，与 ResourceFormDialog 同一处理。这里的描述曾经写
               "删除后无法从界面恢复" —— 两重错：它是描述（见 principles
               第 21 条），而且描述错了（写入是软删除，数据还在库里，只是
               界面上没有恢复入口）。标题已经说了删的是哪一个。 -->
          <AlertDialogDescription class="sr-only" />
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <!-- A plain Button, not AlertDialogAction: the action closes the
               dialog itself, which would clear the target before this
               handler runs. -->
          <Button
            data-slot="alert-dialog-confirm"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            删除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
