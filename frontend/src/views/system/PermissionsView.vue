<script setup lang="ts">
/**
 * The permission list.
 *
 * No relation fields, so `ResourceListView` skips loading candidates
 * entirely and the dialog is a single text input.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { PERMISSIONS } from "@/lib/rbac.ts"
import type { ResourceRow } from "@/lib/resource.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("permissions")

const spec = PERMISSIONS

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.rbac.permissions.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data as ResourceRow[], total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.rbac.permissions({ id }).delete()
  if (error) throw error
}

const save = (body: Record<string, unknown>, id: string | null) =>
  saveResource("permissions", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
