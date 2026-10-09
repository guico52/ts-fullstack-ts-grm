/**
 * Metadata for the five RBAC resources, as plain data.
 *
 * One table per resource feeds the page heading, the table columns and the
 * form fields, so a field renamed in one place cannot disagree with the
 * other three. Rows arrive from the API as `Record<string, unknown>`; the
 * `value`/`toForm` callbacks are where that gets shaped, and they are pure
 * functions — testable without a DOM, which is why they live here and not
 * in a `.vue`.
 *
 * The vocabulary these specs are written in — `ResourceSpec`,
 * `ResourceField`, the row readers, the validators — lives in
 * `lib/resource.ts`, because the library side (`lib/books.ts`) writes specs
 * in the same language. Re-exported here so `from "@/lib/rbac"` keeps
 * working for the pages and the dialog.
 */
import type { CellBadge, FieldOption, ResourceSpec } from "./resource"
import { idsOf, nestedLength, nestedName, rowText } from "./resource"
import { nextSort, type ViewTreeRow } from "./view-tree"
import { VIEW_COMPONENTS } from "./views-catalog"

export * from "./resource"

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

export const VIEW_TYPES: readonly FieldOption[] = [
  { value: "MENU", label: "菜单" },
  { value: "VIEW", label: "页面" },
  { value: "BUTTON", label: "按钮" },
]

/** The badge a view's kind earns. */
function typeBadge(row: Record<string, unknown>): CellBadge {
  const type = String(row.type)
  const label = VIEW_TYPES.find((option) => option.value === type)?.label ?? type
  const tone =
    type === "MENU" ? BADGE_TONES.menu : type === "VIEW" ? BADGE_TONES.page : BADGE_TONES.button
  return { label, tone }
}

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

export const ORGANIZATIONS: ResourceSpec = {
  key: "organizations",
  title: "组织",
  singular: "组织",
  columns: [
    { key: "name", label: "名称", value: (row) => rowText(row, "name") },
    { key: "code", label: "编码", mono: true, value: (row) => rowText(row, "code") },
    { key: "logo", label: "Logo", compact: true, value: (row) => rowText(row, "logo") },
  ],
  fields: [
    { key: "name", label: "名称", kind: "text", required: true, placeholder: "例如：总部" },
    { key: "code", label: "编码", kind: "text", required: true, placeholder: "例如：HQ" },
    { key: "logo", label: "Logo 地址", kind: "text", placeholder: "https://…" },
  ],
  label: (row) => rowText(row, "name"),
  toForm: (row) => ({ name: row.name, code: row.code, logo: row.logo }),
}

export const USERS: ResourceSpec = {
  key: "users",
  title: "用户",
  singular: "用户",
  columns: [
    { key: "name", label: "姓名", value: (row) => rowText(row, "name") },
    { key: "email", label: "邮箱", mono: true, value: (row) => rowText(row, "email") },
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
    },
    {
      key: "organizationId",
      label: "所属组织",
      kind: "select",
      required: true,
      from: "organizations",
    },
  ],
  label: (row) => rowText(row, "email"),
  toForm: (row) => {
    const organization = row.organization
    const organizationId =
      typeof organization === "object" && organization !== null
        ? (organization as Record<string, unknown>).id
        : undefined
    return { name: row.name, email: row.email, password: "", organizationId }
  },
}

export const VIEWS: ResourceSpec = {
  key: "views",
  title: "视图",
  singular: "视图",
  columns: [
    { key: "name", label: "名称", value: (row) => rowText(row, "name") },
    { key: "path", label: "路径", mono: true, value: (row) => rowText(row, "path") },
    {
      key: "componentName",
      label: "组件",
      mono: true,
      compact: true,
      value: (row) => rowText(row, "componentName"),
    },
    {
      key: "type",
      label: "类型",
      value: (row) =>
        VIEW_TYPES.find((option) => option.value === row.type)?.label ?? rowText(row, "type"),
      badge: typeBadge,
    },
    { key: "sort", label: "排序", align: "right", value: (row) => rowText(row, "sort") },
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
    },
    {
      key: "type",
      label: "类型",
      kind: "select",
      required: true,
      span: 1,
      options: VIEW_TYPES,
    },
    {
      key: "sort",
      label: "排序",
      kind: "number",
      span: 1,
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
    },
    {
      key: "path",
      label: "路由路径",
      kind: "text",
      required: true,
      placeholder: "由所选组件自动填写",
      visibleWhen: isPage,
    },
    {
      key: "icon",
      label: "图标",
      kind: "icon",
      required: true,
      legend: "显示与层级",
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
    },
    {
      key: "active",
      label: "启用",
      kind: "boolean",
      span: 1,
    },
  ],
  label: (row) => rowText(row, "name"),
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
  columns: [
    { key: "name", label: "名称", value: (row) => rowText(row, "name") },
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
    { key: "userIds", label: "用户", kind: "links", from: "users" },
    {
      key: "viewIds",
      label: "视图",
      kind: "links",
      from: "views",
      picker: "tree",
    },
    {
      key: "permissionIds",
      label: "权限",
      kind: "links",
      from: "permissions",
    },
  ],
  label: (row) => rowText(row, "name"),
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
  columns: [{ key: "name", label: "名称", value: (row) => rowText(row, "name") }],
  fields: [
    {
      key: "name",
      label: "名称",
      kind: "text",
      required: true,
      placeholder: "例如：rbac.organization.read",
    },
  ],
  label: (row) => rowText(row, "name"),
  toForm: (row) => ({ name: row.name }),
}
