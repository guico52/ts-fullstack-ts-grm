<script setup lang="ts">
import { onMounted, ref } from "vue"
import {
  BookOpen,
  Building2,
  KeyRound,
  LayoutList,
  PenLine,
  ShieldCheck,
  Store,
  Users,
} from "@lucide/vue"

import StatCard from "@/components/data/StatCard.vue"
import PageHeader from "@/components/layout/PageHeader.vue"
import { api } from "@/lib/api.ts"

/**
 * Every card is a row count.
 *
 * This page used to list the API routes and explain the persistence split —
 * written for whoever built the scaffold, read by nobody else. A count is
 * the one thing an overview can say that the sidebar cannot.
 */
const CARDS = [
  {
    key: "organizations",
    label: "组织",
    icon: Building2,
    count: async () => {
      const { data, error } = await api.rbac.organizations.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "users",
    label: "用户",
    icon: Users,
    count: async () => {
      const { data, error } = await api.rbac.users.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "views",
    label: "视图",
    icon: LayoutList,
    count: async () => {
      const { data, error } = await api.rbac.views.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "roles",
    label: "角色",
    icon: ShieldCheck,
    count: async () => {
      const { data, error } = await api.rbac.roles.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "permissions",
    label: "权限",
    icon: KeyRound,
    count: async () => {
      const { data, error } = await api.rbac.permissions.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "books",
    label: "图书",
    icon: BookOpen,
    count: async () => {
      const { data, error } = await api.book.books.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "authors",
    label: "作者",
    icon: PenLine,
    count: async () => {
      const { data, error } = await api.book.authors.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
  {
    key: "stores",
    label: "书店",
    icon: Store,
    count: async () => {
      const { data, error } = await api.book.stores.get({ query: { limit: 1, offset: 0 } })
      if (error) throw error
      return data.total
    },
  },
]

/** `null` means the count could not be read — an em dash, not a zero. */
const counts = ref<Record<string, number | null>>({})
const loading = ref(true)

onMounted(async () => {
  // One failing resource must not take the page down with it.
  const entries = await Promise.all(
    CARDS.map(async (card) => {
      try {
        return [card.key, await card.count()] as const
      } catch {
        return [card.key, null] as const
      }
    }),
  )
  counts.value = Object.fromEntries(entries)
  loading.value = false
})

function valueOf(key: string): string {
  const value = counts.value[key]
  return value === null || value === undefined ? "—" : String(value)
}
</script>

<template>
  <!-- One container pattern for every page: p-4 space-y-4. A page that
       invents its own padding is the fastest way for an app to stop
       looking like one app. -->
  <div class="p-4 space-y-4">
    <PageHeader title="总览" />

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        v-for="card in CARDS"
        :key="card.key"
        :label="card.label"
        :icon="card.icon"
        :value="valueOf(card.key)"
        :loading="loading"
      />
    </div>
  </div>
</template>
