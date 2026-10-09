import { computed } from "vue"
import { useAccessStore } from "@/stores/access"
import type { ResourceKey } from "@/lib/resource"

const PERMISSION_RESOURCE = {
  organizations: "rbac.organization",
  users: "rbac.user",
  views: "rbac.view",
  roles: "rbac.role",
  permissions: "rbac.permission",
  books: "book.book",
  authors: "book.author",
  stores: "book.store",
} satisfies Record<ResourceKey, string>

/** UI 能力通过 props 交给展示组件；安全边界仍在服务端。 */
export function useResourceActions(key: ResourceKey) {
  const access = useAccessStore()
  const prefix = PERMISSION_RESOURCE[key]
  return computed(() => ({
    create: access.can(`${prefix}.create`),
    update: access.can(`${prefix}.update`),
    delete: access.can(`${prefix}.delete`),
  }))
}
