<script setup lang="ts">
/**
 * The role list.
 *
 * Its spec carries three relation fields — users, views and permissions — so
 * `ResourceListView` loads three sets of candidates and the form renders a
 * multi-select each. `VIEWS.picker: "tree"` is what makes the view one a
 * tree instead of a flat list.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { ROLES } from "@/lib/rbac.ts"
import type { ResourceRow } from "@/lib/resource.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("roles")

const spec = ROLES

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.rbac.roles.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data as ResourceRow[], total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.rbac.roles({ id }).delete()
  if (error) throw error
}

const save = (body: Record<string, unknown>, id: string | null) => saveResource("roles", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
