/**
 * Metadata for the five RBAC resources, as plain data.
 *
 * One table per resource feeds the page heading, the table columns and the
 * form fields, so a field renamed in one place cannot disagree with the
 * other two. Rows arrive from the API as `Record<string, unknown>`; the
 * `value`/`toForm` callbacks are where that gets shaped, and they are pure
 * functions — testable without a DOM, which is why they live here and not
 * in a `.vue`.
 */
import { isEmail } from "./validation"

export type ResourceKey = "organizations" | "users" | "views" | "roles" | "permissions"

export type ResourceRow = Record<string, unknown>

export interface FieldOption {
  value: string
  label: string
}

/**
 * `links` is the multi-select for a many-to-many association; `select` is a
 * single reference. Both take their candidates from another resource.
 */
export type FieldKind = "text" | "email" | "number" | "boolean" | "select" | "links"

export interface ResourceField {
  key: string
  label: string
  kind: FieldKind
  /** Required when creating. */
  required?: boolean
  /** Required when editing — defaults to false, which is what makes
   *  "leave blank to keep the current password" expressible. */
  requiredOnUpdate?: boolean
  placeholder?: string
  hint?: string
  /** Fixed choices for `select`. */
  options?: readonly FieldOption[]
  /** Where a `select` / `links` field gets its candidates. */
  from?: ResourceKey
}

export interface ResourceColumn {
  key: string
  label: string
  /** Values that read better in a monospaced font (ids, codes, paths). */
  mono?: boolean
  align?: "right"
  /** Hidden below the md breakpoint to keep narrow screens readable. */
  compact?: boolean
  value: (row: ResourceRow) => string
}

/** The class list a column's cells need, in one place so five tables cannot
 *  drift apart on alignment or the type floor. */
export function columnClass(column: ResourceColumn): string {
  return [
    column.mono ? "font-mono text-xs" : "",
    column.align === "right" ? "text-right tabular-nums" : "",
    column.compact ? "hidden md:table-cell" : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export interface ResourceSpec {
  key: ResourceKey
  /** Page heading and menu label. */
  title: string
  singular: string
  subtitle: string
  columns: readonly ResourceColumn[]
  fields: readonly ResourceField[]
  /** The value used to name a row in confirmations. */
  label: (row: ResourceRow) => string
  /** Row → form values. The inverse of what `fields` describe. */
  toForm: (row: ResourceRow) => Record<string, unknown>
}

export const VIEW_TYPES: readonly FieldOption[] = [
  { value: "MENU", label: "菜单" },
  { value: "VIEW", label: "页面" },
  { value: "BUTTON", label: "按钮" },
]

const text = (row: ResourceRow, key: string): string => {
  const value = row[key]
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

const nestedName = (row: ResourceRow, key: string): string => {
  const nested = row[key]
  if (typeof nested !== "object" || nested === null) return "—"
  const name = (nested as ResourceRow).name
  return name === undefined || name === null ? "—" : String(name)
}

const nestedLength = (row: ResourceRow, key: string): string => {
  const nested = row[key]
  return Array.isArray(nested) ? String(nested.length) : "0"
}

const idsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item === "string") return [item]
        if (typeof item === "object" && item !== null && "id" in item) {
          return [String((item as ResourceRow).id)]
        }
        return []
      })
    : []

export const ORGANIZATIONS: ResourceSpec = {
  key: "organizations",
  title: "组织",
  singular: "组织",
  subtitle: "组织是用户与权限的归属边界。",
  columns: [
    { key: "name", label: "名称", value: (row) => text(row, "name") },
    { key: "code", label: "编码", mono: true, value: (row) => text(row, "code") },
    { key: "logo", label: "Logo", compact: true, value: (row) => text(row, "logo") },
  ],
  fields: [
    { key: "name", label: "名称", kind: "text", required: true, placeholder: "例如：总部" },
    { key: "code", label: "编码", kind: "text", required: true, placeholder: "例如：HQ" },
    { key: "logo", label: "Logo 地址", kind: "text", placeholder: "https://…" },
  ],
  label: (row) => text(row, "name"),
  toForm: (row) => ({ name: row.name, code: row.code, logo: row.logo }),
}

export const USERS: ResourceSpec = {
  key: "users",
  title: "用户",
  singular: "用户",
  subtitle: "用户属于一个组织，口令只以哈希形式保存。",
  columns: [
    { key: "name", label: "姓名", value: (row) => text(row, "name") },
    { key: "email", label: "邮箱", mono: true, value: (row) => text(row, "email") },
    { key: "organization", label: "所属组织", compact: true, value: (row) => nestedName(row, "organization") },
  ],
  fields: [
    { key: "name", label: "姓名", kind: "text", required: true, placeholder: "例如：张三" },
    { key: "email", label: "邮箱", kind: "email", required: true, placeholder: "name@example.com" },
    {
      key: "password",
      label: "口令",
      kind: "text",
      required: true,
      requiredOnUpdate: false,
      hint: "创建时必填；编辑时留空表示不修改。",
    },
    {
      key: "organizationId",
      label: "所属组织",
      kind: "select",
      required: true,
      from: "organizations",
    },
  ],
  label: (row) => text(row, "email"),
  toForm: (row) => {
    const organization = row.organization
    const organizationId =
      typeof organization === "object" && organization !== null
        ? (organization as ResourceRow).id
        : undefined
    return { name: row.name, email: row.email, password: "", organizationId }
  },
}

export const VIEWS: ResourceSpec = {
  key: "views",
  title: "视图",
  singular: "视图",
  subtitle: "视图描述前端可访问的菜单、页面与按钮。",
  columns: [
    { key: "name", label: "名称", value: (row) => text(row, "name") },
    { key: "path", label: "路径", mono: true, value: (row) => text(row, "path") },
    {
      key: "type",
      label: "类型",
      value: (row) => VIEW_TYPES.find((option) => option.value === row.type)?.label ?? text(row, "type"),
    },
    { key: "sort", label: "排序", align: "right", value: (row) => text(row, "sort") },
    { key: "active", label: "启用", compact: true, value: (row) => (row.active ? "是" : "否") },
  ],
  fields: [
    { key: "name", label: "名称", kind: "text", required: true, placeholder: "例如：组织管理" },
    { key: "icon", label: "图标", kind: "text", required: true, placeholder: "Lucide 图标名，例如 Building2" },
    { key: "path", label: "路由路径", kind: "text", required: true, placeholder: "/system/organizations" },
    { key: "componentPath", label: "组件路径", kind: "text", required: true, placeholder: "views/OrganizationsView.vue" },
    { key: "type", label: "类型", kind: "select", required: true, options: VIEW_TYPES },
    { key: "sort", label: "排序", kind: "number", hint: "同一层级内由小到大。" },
    { key: "active", label: "启用", kind: "boolean", hint: "关闭后不参与导航。" },
    { key: "parentId", label: "上级视图", kind: "select", from: "views", hint: "留空表示根节点。" },
  ],
  label: (row) => text(row, "name"),
  toForm: (row) => ({
    name: row.name,
    icon: row.icon,
    path: row.path,
    componentPath: row.componentPath,
    type: row.type,
    sort: row.sort,
    active: row.active,
    parentId: row.parentId,
  }),
}

export const ROLES: ResourceSpec = {
  key: "roles",
  title: "角色",
  singular: "角色",
  subtitle: "角色把用户、视图与权限绑在一起。",
  columns: [
    { key: "name", label: "名称", value: (row) => text(row, "name") },
    { key: "users", label: "用户", align: "right", value: (row) => nestedLength(row, "users") },
    { key: "views", label: "视图", align: "right", value: (row) => nestedLength(row, "views") },
    { key: "permissions", label: "权限", align: "right", value: (row) => nestedLength(row, "permissions") },
  ],
  fields: [
    { key: "name", label: "名称", kind: "text", required: true, placeholder: "例如：管理员" },
    { key: "userIds", label: "用户", kind: "links", from: "users", hint: "保存时整体替换。" },
    { key: "viewIds", label: "视图", kind: "links", from: "views", hint: "保存时整体替换。" },
    {
      key: "permissionIds",
      label: "权限",
      kind: "links",
      from: "permissions",
      hint: "保存时整体替换。",
    },
  ],
  label: (row) => text(row, "name"),
  toForm: (row) => ({
    name: row.name,
    userIds: idsOf(row.users),
    viewIds: idsOf(row.views),
    permissionIds: idsOf(row.permissions),
  }),
}

export const PERMISSIONS: ResourceSpec = {
  key: "permissions",
  title: "权限",
  singular: "权限",
  subtitle: "权限是最小的授权单元，由角色聚合。",
  columns: [{ key: "name", label: "名称", value: (row) => text(row, "name") }],
  fields: [{ key: "name", label: "名称", kind: "text", required: true, placeholder: "例如：rbac.organization.read" }],
  label: (row) => text(row, "name"),
  toForm: (row) => ({ name: row.name }),
}

export const RESOURCES: Record<ResourceKey, ResourceSpec> = {
  organizations: ORGANIZATIONS,
  users: USERS,
  views: VIEWS,
  roles: ROLES,
  permissions: PERMISSIONS,
}

/** Fields whose candidates come from another resource, for the pickers. */
export function relationalFields(spec: ResourceSpec): ResourceField[] {
  return spec.fields.filter((field) => field.from !== undefined)
}

/**
 * Which fields a form of this mode must fill.
 *
 * `password` is the reason this is a function and not a boolean on the
 * field: it is mandatory on create and optional on update.
 */
export function validateResource(
  spec: ResourceSpec,
  values: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const field of spec.fields) {
    const required = mode === "create" ? field.required === true : field.requiredOnUpdate === true
    const value = values[field.key]
    const blank =
      value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)

    if (required && blank) {
      errors[field.key] = `请填写${field.label}。`
      continue
    }
    if (field.kind === "email" && typeof value === "string" && value !== "" && !isEmail(value)) {
      errors[field.key] = "邮箱格式不正确。"
    }
  }

  return errors
}

/**
 * Form values → request body.
 *
 * Empty optional text becomes `null` rather than `""` so clearing a field
 * in the UI actually clears the column, and an untouched `password` is
 * dropped entirely so the server keeps the existing hash.
 */
export function toRequestBody(
  spec: ResourceSpec,
  values: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  for (const field of spec.fields) {
    const value = values[field.key]

    if (field.kind === "boolean") {
      body[field.key] = value === true
      continue
    }

    if (field.kind === "number") {
      body[field.key] = value === "" || value === undefined || value === null ? undefined : Number(value)
      continue
    }

    if (field.kind === "links") {
      body[field.key] = Array.isArray(value) ? value : []
      continue
    }

    if (value === "" || value === undefined) {
      // Nothing typed: omit it on create (let the column default), send null
      // on update so an existing value can be cleared.
      if (mode === "create") continue
      if (!field.required) body[field.key] = null
      continue
    }

    body[field.key] = value
  }

  // An omitted key means "unchanged"; undefined values would be serialized
  // as absent by JSON.stringify anyway, but dropping them here keeps the
  // object honest when a caller inspects it.
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key]
  }

  return body
}
