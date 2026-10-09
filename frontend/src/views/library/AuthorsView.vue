<script setup lang="ts">
/**
 * The author list.
 *
 * Authors are pointed at by books, and hold no reference of their own — so
 * this page has no relation field and no candidates to load. Editing which
 * books an author wrote happens on the book, which is where the association
 * is written; a second write path here would be one more thing to keep in
 * step.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { AUTHORS } from "@/lib/books.ts"
import type { ResourceRow } from "@/lib/resource.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("authors")

const spec = AUTHORS

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.book.authors.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data as ResourceRow[], total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.book.authors({ id }).delete()
  if (error) throw error
}

const save = (body: Record<string, unknown>, id: string | null) => saveResource("authors", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
