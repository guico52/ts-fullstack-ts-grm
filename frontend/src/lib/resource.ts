/**
 * What every resource page is made of: the shape of a spec, and the pure
 * functions that read it.
 *
 * Kept apart from the specs themselves because there is more than one
 * family of them — `rbac.ts` describes the five permission resources,
 * `books.ts` the three on the library side — and both need the same
 * vocabulary. A spec family that had to import its types from another
 * family would be the first sign that this file is missing.
 *
 * Everything here is data or a pure function. Rows arrive from the API as
 * `Record<string, unknown>`; the callbacks are where that gets shaped, and
 * they are testable without a DOM, which is why they live in `lib/`.
 */
import type { Component } from "vue"

import type { DialogSize } from "./dialog-sizes"
import { isEmail } from "./validation"

/**
 * Every resource a picker can point at.
 *
 * Written out rather than derived from the registry: `ResourceSpec.from`
 * needs this type, the registry needs `ResourceSpec`, and defining either
 * from the other would be a cycle. `lib/resources.ts` asserts its table
 * against this union, so a resource added in one place and forgotten in the
 * other fails the typecheck rather than the click.
 */
export type ResourceKey =
  "organizations" | "users" | "views" | "roles" | "permissions" | "books" | "authors" | "stores"

export type ResourceRow = Record<string, unknown>

export interface FieldOption {
  value: string
  label: string
  /**
   * Secondary text on a picker option, right-aligned and monospaced.
   *
   * **This carries data, not prose.** A route, a code, a file name —
   * something the user is choosing *between*. `用于分组` is prose and does
   * not belong here; see docs/principles.md 第 21 条。
   */
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
  /**
   * Step for a `number` input. 1 by default, which is right for a count or
   * an order; a money column needs its own — a `<input type="number">`
   * whose step cannot reach the typed value fails HTML5 validation, and a
   * form that fails validation **never fires `submit`**. The only symptom is
   * a 保存 button that does nothing, with no message anywhere.
   *
   * `numeric(10, 2)` columns therefore want `0.01`.
   */
  step?: number
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

/** The class list a column's cells need, in one place so no two tables can
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

/* -------------------------------------------------------------------------
 * Row readers
 *
 * Every table cell and every `label()` goes through one of these. Written
 * once so that "empty" renders as the same em dash everywhere instead of
 * `""` in one column, `undefined` in another, and `null` in a third.
 * ---------------------------------------------------------------------- */

/** A scalar, or an em dash when it is absent. */
export function rowText(row: ResourceRow, key: string): string {
  const value = row[key]
  return value === null || value === undefined || value === "" ? "—" : String(value)
}

/** The `name` of a nested reference object, for a many-to-one column. */
export function nestedName(row: ResourceRow, key: string): string {
  const nested = row[key]
  if (typeof nested !== "object" || nested === null) return "—"
  const name = (nested as ResourceRow).name
  return name === undefined || name === null ? "—" : String(name)
}

/** How many items a nested collection holds, for a many-to-many column. */
export function nestedLength(row: ResourceRow, key: string): string {
  const nested = row[key]
  return Array.isArray(nested) ? String(nested.length) : "0"
}

/** The `name`s of a nested collection, comma-joined. */
export function nestedNames(row: ResourceRow, key: string): string {
  const nested = row[key]
  if (!Array.isArray(nested) || nested.length === 0) return "—"
  return nested
    .map((item) =>
      typeof item === "object" && item !== null && "name" in item
        ? String((item as ResourceRow).name)
        : String(item),
    )
    .join("、")
}

/** Ids out of a relation field, whether it arrives as ids or as objects. */
export function idsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        if (typeof item === "string") return [item]
        if (typeof item === "object" && item !== null && "id" in item) {
          return [String((item as ResourceRow).id)]
        }
        return []
      })
    : []
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
