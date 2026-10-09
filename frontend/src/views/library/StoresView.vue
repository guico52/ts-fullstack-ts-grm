<script setup lang="ts">
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
import type { ResourceRow } from "@/lib/resource.ts"

const spec = STORES

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.book.stores.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data as ResourceRow[], total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.book.stores({ id }).delete()
  if (error) throw error
}

const save = async (body: Record<string, unknown>, id: string | null) => {
  if (id === null) {
    const { error } = await api.book.stores.post(body as never)
    if (error) throw error
    return
  }
  const { error } = await api.book.stores({ id }).patch(body as never)
  if (error) throw error
}
</script>

<template>
  <ResourceListView :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
