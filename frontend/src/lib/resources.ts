/**
 * Every resource the app knows about, in one table.
 *
 * A picker resolves a `from` key by looking here, so this is the one place
 * that has to stay complete. `satisfies Record<ResourceKey, ResourceSpec>`
 * makes completion a compile-time property rather than a habit: adding a key
 * to `ResourceKey` and forgetting to add its spec fails the typecheck, and
 * adding it here alone fails too.
 *
 * The specs themselves are grouped by domain — `rbac.ts`, `books.ts` —
 * because that is how they are read. Only the lookup lives here.
 */
import { AUTHORS, BOOKS, STORES } from "./books"
import { ORGANIZATIONS, PERMISSIONS, ROLES, USERS, VIEWS } from "./rbac"
import type { ResourceKey, ResourceSpec } from "./resource"

export const RESOURCES = {
  organizations: ORGANIZATIONS,
  users: USERS,
  views: VIEWS,
  roles: ROLES,
  permissions: PERMISSIONS,
  books: BOOKS,
  authors: AUTHORS,
  stores: STORES,
} satisfies Record<ResourceKey, ResourceSpec>

export type { ResourceKey } from "./resource"
