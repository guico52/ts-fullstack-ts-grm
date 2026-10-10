/**
 * Candidates for the relational fields of any resource form.
 *
 * A picker needs `{ value, label }`, and the label is whatever that
 * resource uses to name a row — which is exactly what `spec.label` already
 * answers, so it is not duplicated here.
 *
 * One page of up to 100 rows is enough for a picker at this size; a
 * resource that outgrows it wants a searchable picker, not a bigger limit.
 *
 * The switch is **exhaustive by construction**: `ResourceKey` is a closed
 * union, so adding a resource without teaching this function how to fetch
 * it is a typecheck failure rather than an empty dropdown at runtime. That
 * is what the `never` in the default arm is for — it is a compile-time
 * assertion, not an error path.
 */
import { api } from "./api"
import type { FieldOption, ResourceRow, ResourceSpec } from "./resource"
import { RESOURCES, type ResourceKey } from "./resources"

const OPTION_LIMIT = 100

async function listForOptions(key: ResourceKey): Promise<ResourceRow[]> {
  const query = { limit: OPTION_LIMIT, offset: 0 }
  switch (key) {
    case "organizations": {
      const { data, error } = await api.rbac.organizations.get({ query })
      if (error) throw error
      return data.data
    }
    case "users": {
      const { data, error } = await api.rbac.users.get({ query })
      if (error) throw error
      return data.data
    }
    case "views": {
      const { data, error } = await api.rbac.views.get({ query })
      if (error) throw error
      return data.data
    }
    case "roles": {
      const { data, error } = await api.rbac.roles.get({ query })
      if (error) throw error
      return data.data
    }
    case "permissions": {
      const { data, error } = await api.rbac.permissions.get({ query })
      if (error) throw error
      return data.data
    }
    case "books": {
      const { data, error } = await api.book.books.get({ query })
      if (error) throw error
      return data.data
    }
    case "authors": {
      const { data, error } = await api.book.authors.get({ query })
      if (error) throw error
      return data.data
    }
    case "stores": {
      const { data, error } = await api.book.stores.get({ query })
      if (error) throw error
      return data.data
    }
    default: {
      const unhandled: never = key
      throw new Error(`未处理的资源：${String(unhandled)}`)
    }
  }
}

async function optionsOf(key: ResourceKey): Promise<FieldOption[]> {
  const rows = await listForOptions(key)
  return rows.map((row) => ({
    value: String(row.id),
    label: RESOURCES[key].label(row),
    // A tree picker needs the shape of the tree, not just the leaves.
    ...(key === "views"
      ? {
          parentId: row.parentId == null ? null : String(row.parentId),
          sort: Number(row.sort) || 0,
        }
      : {}),
  }))
}

/** Options keyed by field, for every relational field the spec declares. */
export async function loadFieldOptions(spec: ResourceSpec): Promise<Record<string, FieldOption[]>> {
  const fields = spec.fields.filter((field) => field.from !== undefined)
  const keys = [...new Set(fields.map((field) => field.from as ResourceKey))]

  const fetched = new Map<ResourceKey, FieldOption[]>()
  await Promise.all(
    keys.map(async (key) => {
      fetched.set(key, await optionsOf(key))
    }),
  )

  const options: Record<string, FieldOption[]> = {}
  for (const field of fields) {
    options[field.key] = fetched.get(field.from as ResourceKey) ?? []
  }
  return options
}
