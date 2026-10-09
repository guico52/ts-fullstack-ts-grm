<script setup lang="ts">
import { computed, ref } from "vue"
import { Plus } from "@lucide/vue"

import ActionError from "@/components/data/ActionError.vue"
import PageHeader from "@/components/layout/PageHeader.vue"
import ResourceFormDialog from "@/components/rbac/ResourceFormDialog.vue"
import ViewTreeTable from "@/components/rbac/ViewTreeTable.vue"
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
import { useResource } from "@/composables/useResource"
import { api, describeApiError } from "@/lib/api"
import { VIEWS, type FieldOption, type ResourceRow } from "@/lib/rbac"
import { nextSort, type ViewTreeRow } from "@/lib/view-tree"

const spec = VIEWS

/**
 * Views are a tree, not a list: a page belongs to a menu and a button to a
 * page, and a flat table cannot show that. So the whole tree is fetched at
 * once and rendered collapsibly — there is no page number to jump to, which
 * is also why this page has no `DataPagination`.
 */
const {
  rows,
  total,
  loading,
  error: loadError,
  load,
  remove,
} = useResource<ResourceRow>(
  {
    list: async () => {
      const { data, error } = await api.rbac.views.get({ query: { limit: 100, offset: 0 } })
      if (error) throw error
      return { rows: data.data as ResourceRow[], total: data.total }
    },
    remove: async (id) => {
      const { error } = await api.rbac.views({ id }).delete()
      if (error) throw error
    },
  },
  { pageSize: 100 },
)

/**
 * Parent candidates come from the tree already in hand, so the picker needs
 * no second request. Each option carries its kind, which is what lets the
 * dialog offer only the level above.
 */
const options = computed<Record<string, FieldOption[]>>(() => ({
  parentId: rows.value.map((row) => ({
    value: String(row.id),
    label: String(row.name),
    kind: String(row.type),
  })),
}))

const formOpen = ref(false)
const editing = ref<ResourceRow | null>(null)
/** Values the form opens a *new* record with; see `addChild`. */
const seed = ref<Record<string, unknown> | null>(null)
const pendingDelete = ref<ResourceRow | null>(null)
/** The row whose delete is in flight, so its button can say so. */
const pendingRemoveId = ref<string | null>(null)
const actionError = ref<string | null>(null)

function openCreate() {
  editing.value = null
  seed.value = null
  formOpen.value = true
}

function openEdit(row: ResourceRow) {
  editing.value = row
  seed.value = null
  formOpen.value = true
}

/**
 * Add a child from a row's ⊕ button.
 *
 * Which row the button was on already answers the three questions the form
 * would otherwise ask — the parent, the kind, and the order among the
 * (possibly empty) existing siblings — so it opens with them filled and the
 * cursor in the one field that is left.
 */
function addChild(parent: ResourceRow) {
  const type = parent.type
  if (type !== "MENU" && type !== "VIEW") return
  const parentId = String(parent.id)
  editing.value = null
  seed.value = {
    parentId,
    type: type === "MENU" ? "VIEW" : "BUTTON",
    sort: nextSort(rows.value as ViewTreeRow[], parentId),
  }
  formOpen.value = true
}

async function save(body: Record<string, unknown>, id: string | null) {
  if (id === null) {
    const { error } = await api.rbac.views.post(body as never)
    if (error) throw error
  } else {
    const { error } = await api.rbac.views({ id }).patch(body as never)
    if (error) throw error
  }
}

async function confirmDelete() {
  const target = pendingDelete.value
  pendingDelete.value = null
  if (!target) return

  const id = String(target.id)
  actionError.value = null
  pendingRemoveId.value = id
  try {
    await remove(id)
  } catch (cause) {
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
        <!-- Say what the number counts, and how the rows are organised. -->
        <CardDescription>共 {{ total }} 条，按 菜单 → 页面 → 按钮 三层展开</CardDescription>
      </CardHeader>

      <CardContent class="px-0">
        <ViewTreeTable
          :columns="spec.columns"
          :rows="rows"
          :loading="loading"
          :pending-remove-id="pendingRemoveId"
          @edit="openEdit"
          @remove="pendingDelete = $event"
          @add-child="addChild"
        />
        <p v-if="loadError" class="text-destructive px-6 pb-6 text-center text-sm">
          {{ loadError }}
        </p>
      </CardContent>
    </Card>

    <ResourceFormDialog
      v-model:open="formOpen"
      :spec="spec"
      :record="editing"
      :options="options"
      :rows="rows"
      :seed="seed"
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
            该{{ spec.singular }}会被软删除，之后不再出现在列表与查询中。其下级节点会失去上级。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
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
