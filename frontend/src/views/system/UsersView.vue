<script setup lang="ts">
/**
 * The user list.
 *
 * The organization picker's candidates are loaded by `ResourceListView`:
 * the spec says `organizationId` has a `from`, and that is the whole
 * declaration needed. See `lib/field-options.ts`.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { USERS } from "@/lib/rbac.ts"
import type { ResourceRow } from "@/lib/resource.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("users")

const spec = USERS

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.rbac.users.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data as ResourceRow[], total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.rbac.users({ id }).delete()
  if (error) throw error
}

const save = (body: Record<string, unknown>, id: string | null) => saveResource("users", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
