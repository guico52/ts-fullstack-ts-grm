<script setup lang="ts">
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
import { useResource } from "@/composables/useResource"
import { api, describeApiError } from "@/lib/api"
import { USERS, columnClass, type FieldOption, type ResourceRow } from "@/lib/rbac"
import { loadFieldOptions } from "@/lib/rbac-options"

const spec = USERS

const {
  rows,
  total,
  page,
  pageSize,
  pageInfo,
  loading,
  error: loadError,
  load,
  remove,
} = useResource<ResourceRow>({
  list: async ({ limit, offset }) => {
    const { data, error } = await api.rbac.users.get({ query: { limit, offset } })
    if (error) throw error
    return { rows: data.data as ResourceRow[], total: data.total }
  },
  remove: async (id) => {
    const { error } = await api.rbac.users({ id }).delete()
    if (error) throw error
  },
})

/** 关联字段的候选项；加载失败不阻塞列表。 */
const options = ref<Record<string, FieldOption[]>>({})

onMounted(async () => {
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

/**
 * The form values are shaped by `validateResource`, so the cast is about
 * the dynamic key set, not about skipping validation.
 */
async function save(body: Record<string, unknown>, id: string | null) {
  if (id === null) {
    const { error } = await api.rbac.users.post(body as never)
    if (error) throw error
  } else {
    const { error } = await api.rbac.users({ id }).patch(body as never)
    if (error) throw error
  }
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
    await remove(id)
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
    <PageHeader :title="spec.title" :subtitle="spec.subtitle">
      <template #actions>
        <Button @click="openCreate">
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
              <TableHead class="w-20"><span class="sr-only">操作</span></TableHead>
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
              <TableCell>
                <div class="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        :aria-label="`编辑 ${spec.label(row)}`"
                        @click="openEdit(row)"
                      >
                        <Pencil class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>编辑</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="hover:bg-destructive/10 hover:text-destructive"
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
            {{ loading ? "加载中…" : loadError ?? `还没有${spec.singular}。` }}
          </p>
          <div v-if="!loading" class="mt-4 flex justify-center">
            <Button @click="openCreate">
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
          <AlertDialogDescription>
            该{{ spec.singular }}会被软删除，之后不再出现在列表与查询中。
          </AlertDialogDescription>
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
