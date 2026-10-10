<script setup lang="ts">
import type { ResourceFormValues } from "@/lib/resource"
/**
 * The user list.
 *
 * The organization picker's candidates are loaded by `ResourceListView`:
 * the spec says `organizationId` has a `from`, and that is the whole
 * declaration needed. See `lib/field-options.ts`.
 */
import { onMounted, ref } from "vue"
import ResetPasswordDialog from "@/components/rbac/ResetPasswordDialog.vue"
import { Button } from "@/components/ui/button"
import { useAccessStore } from "@/stores/access"
import ResourceListView from "@/components/data/ResourceListView.vue"
import { api } from "@/lib/api.ts"
import { USERS } from "@/lib/rbac.ts"
import type { ResourceRow } from "@/lib/resource.ts"

import { saveResource } from "@/lib/resource-api"
import { useResourceActions } from "@/composables/useResourceActions"

const access = useAccessStore()
const accessError = ref<string | null>(null)
onMounted(async () => {
  try {
    await access.load()
  } catch {
    accessError.value = "操作权限加载失败，请刷新重试。"
  }
})
const resetTarget = ref<ResourceRow | null>(null)
const resetOpen = ref(false)
function openReset(row: ResourceRow) {
  resetTarget.value = row
  resetOpen.value = true
}

const actions = useResourceActions("users")

const spec = USERS

const list = async ({ limit, offset }: { limit: number; offset: number }) => {
  const { data, error } = await api.rbac.users.get({ query: { limit, offset } })
  if (error) throw error
  return { rows: data.data, total: data.total }
}

const remove = async (id: string) => {
  const { error } = await api.rbac.users({ id }).delete()
  if (error) throw error
}

const save = (body: ResourceFormValues, id: string | null) => saveResource("users", body, id)
</script>

<template>
  <p v-if="accessError" role="alert" class="p-4 text-sm text-destructive">{{ accessError }}</p>
  <ResourceListView :actions="actions" :spec="spec" :list="list" :remove="remove" :save="save">
    <template v-if="access.can('rbac.user.resetPassword')" #row-actions="{ row }"
      ><Button
        variant="ghost"
        size="sm"
        :aria-label="`重置密码 ${spec.label(row)}`"
        @click="openReset(row)"
        >重置密码</Button
      ></template
    >
  </ResourceListView>
  <ResetPasswordDialog
    v-if="resetTarget"
    v-model:open="resetOpen"
    :user-id="String(resetTarget.id)"
    :label="spec.label(resetTarget)"
  />
</template>
