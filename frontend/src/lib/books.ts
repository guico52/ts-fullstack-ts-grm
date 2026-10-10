/**
 * Metadata for the three library resources, as plain data.
 *
 * Same shape as `rbac.ts` — one table per resource driving heading, columns
 * and form fields — and the same vocabulary, imported from `lib/resource.ts`.
 *
 * The three are not symmetric, and the asymmetry is the point: a book owns
 * the associations (`storeId` is a foreign key on `book`, the author links
 * live in a join table), while an author and a store are simple rows that
 * books point *at*. So only `BOOKS` has relation fields, and the other two
 * expose no back-reference — a picker that could edit a book from inside an
 * author's form would be a second write path to keep in step.
 */
import type { ResourceSpec } from "./resource"
import { idsOf, nestedName, nestedNames, rowText } from "./resource"

export const STORES: ResourceSpec = {
  key: "stores",
  title: "书店",
  singular: "书店",
  columns: [{ key: "name", label: "名称", value: (row) => rowText(row, "name") }],
  fields: [
    {
      key: "name",
      label: "名称",
      kind: "text",
      required: true,
      placeholder: "例如：新华书店",
    },
  ],
  label: (row) => rowText(row, "name"),
  toForm: (row) => ({ name: row.name }),
}

export const AUTHORS: ResourceSpec = {
  key: "authors",
  title: "作者",
  singular: "作者",
  columns: [{ key: "name", label: "名称", value: (row) => rowText(row, "name") }],
  fields: [
    {
      key: "name",
      label: "名称",
      kind: "text",
      required: true,
      placeholder: "例如：Kathy Sierra",
    },
  ],
  label: (row) => rowText(row, "name"),
  toForm: (row) => ({ name: row.name }),
}

export const BOOKS: ResourceSpec = {
  key: "books",
  title: "图书",
  singular: "图书",
  columns: [
    { key: "name", label: "书名", value: (row) => rowText(row, "name") },
    { key: "edition", label: "版次", align: "right", value: (row) => rowText(row, "edition") },
    {
      key: "price",
      label: "定价",
      mono: true,
      align: "right",
      // 后端把 numeric 读成 number，88.50 到前端就只剩 88.5 —— 钱的位数
      // 是它的一部分，所以在这里补回来。
      value: (row) => {
        const value = row.price
        return typeof value === "number" ? value.toFixed(2) : rowText(row, "price")
      },
    },
    { key: "store", label: "书店", value: (row) => nestedName(row, "store") },
    {
      key: "authors",
      label: "作者",
      compact: true,
      value: (row) => nestedNames(row, "authors"),
    },
  ],
  fields: [
    {
      key: "name",
      label: "书名",
      kind: "text",
      required: true,
      legend: "基本信息",
      placeholder: "例如：深入理解计算机系统",
    },
    {
      key: "edition",
      label: "版次",
      kind: "number",
      required: true,
      span: 1,
      placeholder: "例如：3",
    },
    {
      key: "price",
      label: "定价",
      kind: "number",
      required: true,
      span: 1,
      // numeric(10, 2)：默认 step=1 会让 88.50 无法提交，且不报错。
      step: 0.01,
      placeholder: "例如：128.00",
    },
    {
      key: "storeId",
      label: "书店",
      kind: "select",
      required: true,
      legend: "关联",
      from: "stores",
    },
    {
      key: "authorIds",
      label: "作者",
      kind: "links",
      from: "authors",
    },
  ],
  label: (row) => rowText(row, "name"),
  toForm: (row) => {
    const storeId = row.store?.id
    return {
      name: row.name,
      edition: row.edition,
      price: row.price,
      storeId,
      authorIds: idsOf(row.authors),
    }
  },
}
