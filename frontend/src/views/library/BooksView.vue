<script setup lang="ts">
import type { ResourceFormValues } from "@/lib/resource"
/**
 * The book list.
 *
 * `spec.storeId` is a single reference and `spec.authorIds` a many-to-many,
 * so the form renders a `Combobox` for one and a `MultiSelect` for the
 * other — decided by the spec, not by this file.
 */
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { BOOKS } from "@/lib/books.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const actions = useResourceActions("books")

const spec = BOOKS

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.book.books.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data, total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.book.books({ id }).delete()
  if (error) throw error
}

const save = (body: ResourceFormValues, id: string | null) => saveResource("books", body, id)
</script>

<template>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save" />
</template>
