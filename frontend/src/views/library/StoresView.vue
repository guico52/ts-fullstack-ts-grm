<script setup lang="ts">
import type { ResourceFormValues } from "@/lib/resource"
/**
 * The store list.
 *
 * Same shape as the author list: stores are referred to by books, so this
 * page carries no relation field. A store that still has books cannot be
 * deleted softly out of their way — the books keep their `store_id`, and the
 * store simply stops appearing in this list.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { STORES } from "@/lib/books.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("stores")

const spec = STORES

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.book.stores.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data, total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.book.stores({ id }).delete()
  if (error) throw error
}

const save = (body: ResourceFormValues, id: string | null) => saveResource("stores", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
