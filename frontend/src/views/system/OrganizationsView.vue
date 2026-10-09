<script setup lang="ts">
/**
 * The organization list.
 *
 * A page is its spec plus three API calls — the table, the dialog, the
 * paginator and the relation pickers are the same for every resource and
 * live in `ResourceListView`. Adding a resource is this file, a spec in
 * `lib/`, a route and a nav entry.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { ORGANIZATIONS } from "@/lib/rbac.ts"
import type { ResourceRow } from "@/lib/resource.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("organizations")

const spec = ORGANIZATIONS

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.rbac.organizations.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data as ResourceRow[], total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.rbac.organizations({ id }).delete()
  if (error) throw error
}

const save = (body: Record<string, unknown>, id: string | null) =>
  saveResource("organizations", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
