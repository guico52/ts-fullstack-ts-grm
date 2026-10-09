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
import type { Component } from "vue"

import type { DialogSize } from "./dialog-sizes"
import { isEmail } from "./validation"
import { nextSort, type ViewTreeRow } from "./view-tree"
import { VIEW_COMPONENTS } from "./views-catalog"

export type ResourceKey = "organizations" | "users" | "views" | "roles" | "permissions"

export type ResourceRow = Record<string, unknown>

export interface FieldOption {
  value: string
  label: string
  /** Secondary text, shown right-aligned in a picker — a route, a code. */
  hint?: string
  /** Leading glyph. */
  icon?: Component
  /**
   * Free-form tag the resource can filter on — a view option carries the
   * kind of node it points at, so a parent picker can offer only the level
   * above.
   */
  kind?: string
  /** Parent value, for a picker that shows the options as a tree. */
  parentId?: string | null
  /** Sibling order, honoured by the tree picker. */
  sort?: number
}

/**
 * `links` is the multi-select for a many-to-many association; `select` is a
 * single reference. Both take their candidates from another resource.
 *
 * `icon` and `component` render pickers instead of inputs — see
 * `components/rbac/` — because typing a file name or an icon name by hand is
 * exactly the kind of thing that produces a view that cannot be rendered.
 */
export type FieldKind =
  "text" | "email" | "number" | "boolean" | "select" | "links" | "icon" | "component"

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
  /**
   * One sentence on *why* the field exists, under the control. A field with
   * no explanation is a field the user has to guess about — and the guess is
   * usually about what it is for, not what to type.
   */
  hint?: string
  /**
   * Section this field belongs to. Fields sharing a `legend` are rendered
   * together, in declaration order, under one heading; a `legend` that
   * differs from the previous field's starts a new one.
   */
  legend?: string
  /**
   * Half width on a wide dialog; full width by default. Two adjacent
   * half-width fields sit side by side, which is how a short field like
   * 排序 avoids taking a whole row from a long one like 名称.
   */
  span?: 1 | 2
  /** A picker that can be emptied — for a reference that may be absent. */
  clearable?: boolean
  /**
   * How a `links` field is picked: a flat multi-select, or the tree.
   *
   * A role grants pages, and a page only means something under its menu, so
   * that one is a `tree`. Users and permissions have no hierarchy to keep.
   */
  picker?: "multi" | "tree"
  /**
   * A value the dialog keeps in step with the other fields, until the user
   * edits this one by hand.
   *
   * A view's `sort` is a position among its siblings, so it depends on the
   * parent — which is itself a field. Typing a value stops the automatic one
   * from overwriting it.
   */
  auto?: (values: Record<string, unknown>, rows: readonly ResourceRow[]) => unknown
  /**
   * Hide the field when this returns false.
   *
   * For a field that only applies to one kind of record: a view's route and
   * component mean nothing for a menu (a grouping node) or a button (a
   * permission point). A hidden field is not validated and is cleared on
   * update, so switching kinds cannot strand a value the record no longer
   * has a use for.
   */
  visibleWhen?: (values: Record<string, unknown>) => boolean
  /**
   * Required only for some kinds of record — a view's parent is mandatory
   * for a page or a button, and meaningless for a menu.
   */
  requiredWhen?: (values: Record<string, unknown>) => boolean
  /** Fixed choices for `select`. */
  options?: readonly FieldOption[]
  /** Where a `select` / `links` field gets its candidates. */
  from?: ResourceKey
  /**
   * Values this field fills in alongside its own, derived from the chosen
   * value. The component picker uses it to write `componentName` and the
   * route at the same time, so one click replaces three typed strings.
   */
  derive?: (value: string) => Record<string, unknown>
}

/**
 * A cell rendered as a coloured label instead of plain text.
 *
 * `tone` is a class list built from design tokens (`bg-chart-1/10 text-chart-1`),
 * never a literal colour — the tokens already carry a light and a dark value,
 * and a hard-coded hex would only work in one of them.
 */
export interface CellBadge {
  label: string
  tone?: string
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
  /** When present, the cell renders as this badge rather than as text. */
  badge?: (row: ResourceRow) => CellBadge | null
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
  /**
   * Dialog width. Optional — `ResourceFormDialog` picks one from the field
   * layout when this is absent, widening for dialogs whose fields pair up.
   */
  width?: DialogSize
  columns: readonly ResourceColumn[]
  fields: readonly ResourceField[]
  /** The value used to name a row in confirmations. */
  label: (row: ResourceRow) => string
  /** Row → form values. The inverse of what `fields` describe. */
  toForm: (row: ResourceRow) => Record<string, unknown>
  /**
   * Narrow a picker's options to those valid for the current draft. For the
   * view form: a page's parent must be a menu, a button's must be a page.
   */
  narrowOptions?: (
    field: ResourceField,
    options: readonly FieldOption[],
    values: Record<string, unknown>,
  ) => readonly FieldOption[]
}

/**
 * Badge tones, shared by the table and the tree.
 *
 * Only `chart-1`, `chart-4` and `chart-5` are dark enough to carry text on a
 * light card; `chart-2` and `chart-3` are series fills and disappear as text.
 * The tinted background is the same hue at low opacity, so the label reads as
 * one object instead of a coloured box with black text in it.
 */
export const BADGE_TONES = {
  menu: "bg-primary/10 text-primary",
  page: "bg-chart-1/10 text-chart-1",
  button: "bg-muted text-muted-foreground",
  on: "bg-chart-4/12 text-chart-4",
  off: "bg-muted text-muted-foreground",
} as const

/** The badge a view's kind earns. */
function typeBadge(row: ResourceRow): CellBadge {
  const type = String(row.type)
  const label = VIEW_TYPES.find((option) => option.value === type)?.label ?? type
  const tone =
    type === "MENU" ? BADGE_TONES.menu : type === "VIEW" ? BADGE_TONES.page : BADGE_TONES.button
  return { label, tone }
}

export const VIEW_TYPES: readonly FieldOption[] = [
  { value: "MENU", label: "菜单", hint: "用于分组" },
  { value: "VIEW", label: "页面", hint: "承载组件" },
  { value: "BUTTON", label: "按钮", hint: "最小授权点" },
]

/** Route and component only apply to a page; see `visibleWhen` usage below. */
const isPage = (values: Record<string, unknown>): boolean => values.type === "VIEW"

/**
 * The tree is three levels: a page hangs off a menu (or stands on its own),
 * a button off a page. Mirrors the check the backend enforces — this one
 * only narrows the picker, so an invalid pairing cannot be expressed.
 */
const PARENT_OF: Record<string, string | null> = {
  MENU: null,
  VIEW: "MENU",
  BUTTON: "VIEW",
}

/**
 * A button must belong to a page. A page may stand at the top level, so its
 * parent is optional — only the menu is forbidden a parent.
 */
const needsParent = (values: Record<string, unknown>): boolean => values.type === "BUTTON"

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
    {
      key: "organization",
      label: "所属组织",
      compact: true,
      value: (row) => nestedName(row, "organization"),
    },
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
      key: "componentName",
      label: "组件",
      mono: true,
      compact: true,
      value: (row) => text(row, "componentName"),
    },
    {
      key: "type",
      label: "类型",
      value: (row) =>
        VIEW_TYPES.find((option) => option.value === row.type)?.label ?? text(row, "type"),
      badge: typeBadge,
    },
    { key: "sort", label: "排序", align: "right", value: (row) => text(row, "sort") },
    {
      key: "active",
      label: "启用",
      compact: true,
      value: (row) => (row.active ? "是" : "否"),
      badge: (row) => ({
        label: row.active ? "启用" : "停用",
        tone: row.active ? BADGE_TONES.on : BADGE_TONES.off,
      }),
    },
  ],
  fields: [
    {
      key: "name",
      label: "名称",
      kind: "text",
      required: true,
      placeholder: "例如：组织管理",
      legend: "基本信息",
      hint: "显示在侧栏和面包屑上的名字。",
    },
    {
      key: "type",
      label: "类型",
      kind: "select",
      required: true,
      span: 1,
      options: VIEW_TYPES,
      hint: "菜单用于分组，页面承载组件，按钮是最小授权点。",
    },
    {
      key: "sort",
      label: "排序",
      kind: "number",
      span: 1,
      hint: "同层级内由小到大；不填则由系统排到同级最后。",
      // A position among siblings: it follows the parent, which is itself a
      // field. Any sibling level counts on its own.
      auto: (values, rows) =>
        nextSort(rows as ViewTreeRow[], values.parentId ? String(values.parentId) : null),
    },
    {
      key: "componentPath",
      label: "组件",
      kind: "component",
      required: true,
      span: 1,
      legend: "组件与路由",
      visibleWhen: isPage,
      hint: "选中后，组件名与路由一并填好。",
      // One choice, three columns: the file name is the component name, and
      // its kebab-case form is the route. See lib/views-catalog.ts.
      derive: (componentPath) => {
        const found = VIEW_COMPONENTS.find((component) => component.path === componentPath)
        return found ? { componentName: found.name, path: found.route } : {}
      },
    },
    {
      key: "componentName",
      label: "组件名",
      kind: "text",
      required: true,
      span: 1,
      placeholder: "由所选组件自动填写",
      visibleWhen: isPage,
      hint: "组件文件名，大驼峰形式。",
    },
    {
      key: "path",
      label: "路由路径",
      kind: "text",
      required: true,
      placeholder: "由所选组件自动填写",
      visibleWhen: isPage,
      hint: "组件名的小写加 - 形式。",
    },
    {
      key: "icon",
      label: "图标",
      kind: "icon",
      required: true,
      legend: "显示与层级",
      hint: "从下面的清单中点选；悬停可以看到图标名。",
    },
    {
      key: "parentId",
      label: "上级视图",
      kind: "select",
      from: "views",
      span: 1,
      clearable: true,
      visibleWhen: (values) => values.type !== "MENU",
      requiredWhen: needsParent,
      hint: "页面可挂在菜单下，也可独立；按钮必须挂在页面下。",
    },
    {
      key: "active",
      label: "启用",
      kind: "boolean",
      span: 1,
      hint: "关闭后不参与导航，配置仍然保留。",
    },
  ],
  label: (row) => text(row, "name"),
  narrowOptions: (field, options, values) => {
    if (field.key !== "parentId") return options
    const required = PARENT_OF[String(values.type)] ?? null
    return options.filter((option) => option.kind === required)
  },
  toForm: (row) => ({
    name: row.name,
    icon: row.icon,
    path: row.path,
    componentPath: row.componentPath,
    componentName: row.componentName,
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
    {
      key: "permissions",
      label: "权限",
      align: "right",
      value: (row) => nestedLength(row, "permissions"),
    },
  ],
  fields: [
    { key: "name", label: "名称", kind: "text", required: true, placeholder: "例如：管理员" },
    { key: "userIds", label: "用户", kind: "links", from: "users", hint: "保存时整体替换。" },
    {
      key: "viewIds",
      label: "视图",
      kind: "links",
      from: "views",
      picker: "tree",
      hint: "按 菜单 → 页面 → 按钮 的层级选择；保存时整体替换。",
    },
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
  fields: [
    {
      key: "name",
      label: "名称",
      kind: "text",
      required: true,
      placeholder: "例如：rbac.organization.read",
    },
  ],
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
    // A field the current kind of record has no use for is not required.
    if (field.visibleWhen && !field.visibleWhen(values)) continue

    const required = field.requiredWhen
      ? field.requiredWhen(values)
      : mode === "create"
        ? field.required === true
        : field.requiredOnUpdate === true
    const value = values[field.key]
    const blank =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)

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

    // Not applicable to this kind of record. Cleared on update, so a view
    // switched from 页面 to 菜单 does not keep a route it no longer has.
    if (field.visibleWhen && !field.visibleWhen(values)) {
      if (mode === "update") body[field.key] = null
      continue
    }

    if (field.kind === "boolean") {
      body[field.key] = value === true
      continue
    }

    if (field.kind === "number") {
      body[field.key] =
        value === "" || value === undefined || value === null ? undefined : Number(value)
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
