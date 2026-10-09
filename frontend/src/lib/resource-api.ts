/** 通用表单的 unknown 边界在这里检查；返回体由后端 schema 推导，禁止类型断言绕过 Treaty。 */
import { api } from "./api"
import type { ResourceKey } from "./resource"
import type { OrganizationModel } from "../../../backend/src/modules/rbac/organization/model"
import type { UserModel } from "../../../backend/src/modules/rbac/user/model"
import type { ViewModel } from "../../../backend/src/modules/rbac/view/model"
import type { RoleModel } from "../../../backend/src/modules/rbac/role/model"
import type { PermissionModel } from "../../../backend/src/modules/rbac/permission/model"
import type { BookModel } from "../../../backend/src/modules/book/book/model"
import type { AuthorModel } from "../../../backend/src/modules/book/author/model"
import type { StoreModel } from "../../../backend/src/modules/book/store/model"

type Draft = Record<string, unknown>
function text(body: Draft, key: string): string {
  const value = body[key]
  if (typeof value !== "string") throw new Error(`${key} 必须是字符串`)
  return value
}
function optionalText(body: Draft, key: string): string | undefined {
  return body[key] === undefined ? undefined : text(body, key)
}
function nullableText(body: Draft, key: string): string | null | undefined {
  return body[key] === null ? null : optionalText(body, key)
}
function number(body: Draft, key: string): number {
  const value = body[key]
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} 必须是有限数字`)
  return value
}
function optionalNumber(body: Draft, key: string): number | undefined {
  return body[key] === undefined ? undefined : number(body, key)
}
function boolean(body: Draft, key: string): boolean | undefined {
  const value = body[key]
  if (value === undefined || typeof value === "boolean") return value
  throw new Error(`${key} 必须是布尔值`)
}
function ids(body: Draft, key: string): string[] | undefined {
  const value = body[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every((id): id is string => typeof id === "string")) {
    throw new Error(`${key} 必须是字符串数组`)
  }
  return value
}
function viewType(body: Draft): "MENU" | "VIEW" | "BUTTON" {
  const value = body.type
  if (value !== "MENU" && value !== "VIEW" && value !== "BUTTON") throw new Error("未知视图类型")
  return value
}

export function createOrganization(body: Draft): OrganizationModel["createBody"] {
  return {
    name: text(body, "name"),
    code: text(body, "code"),
    logo: nullableText(body, "logo"),
  }
}

export function updateOrganization(body: Draft): OrganizationModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
    code: optionalText(body, "code"),
    logo: nullableText(body, "logo"),
  }
}

export function createUser(body: Draft): UserModel["createBody"] {
  return {
    name: text(body, "name"),
    email: text(body, "email"),
    password: text(body, "password"),
    organizationId: text(body, "organizationId"),
  }
}

export function updateUser(body: Draft): UserModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
    email: optionalText(body, "email"),
    password: optionalText(body, "password"),
    organizationId: optionalText(body, "organizationId"),
  }
}

export function createView(body: Draft): ViewModel["createBody"] {
  return {
    name: text(body, "name"),
    icon: text(body, "icon"),
    type: viewType(body),
    path: nullableText(body, "path"),
    componentPath: nullableText(body, "componentPath"),
    componentName: nullableText(body, "componentName"),
    parentId: nullableText(body, "parentId"),
    sort: optionalNumber(body, "sort"),
    active: boolean(body, "active"),
  }
}

export function updateView(body: Draft): ViewModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
    icon: optionalText(body, "icon"),
    type: body.type === undefined ? undefined : viewType(body),
    path: nullableText(body, "path"),
    componentPath: nullableText(body, "componentPath"),
    componentName: nullableText(body, "componentName"),
    parentId: nullableText(body, "parentId"),
    sort: optionalNumber(body, "sort"),
    active: boolean(body, "active"),
  }
}

export function createRole(body: Draft): RoleModel["createBody"] {
  return {
    name: text(body, "name"),
    userIds: ids(body, "userIds"),
    viewIds: ids(body, "viewIds"),
    permissionIds: ids(body, "permissionIds"),
  }
}

export function updateRole(body: Draft): RoleModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
    userIds: ids(body, "userIds"),
    viewIds: ids(body, "viewIds"),
    permissionIds: ids(body, "permissionIds"),
  }
}

export function createPermission(body: Draft): PermissionModel["createBody"] {
  return {
    name: text(body, "name"),
  }
}

export function updatePermission(body: Draft): PermissionModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
  }
}

export function createBook(body: Draft): BookModel["createBody"] {
  return {
    name: text(body, "name"),
    edition: number(body, "edition"),
    price: number(body, "price"),
    storeId: text(body, "storeId"),
    authorIds: ids(body, "authorIds"),
  }
}

export function updateBook(body: Draft): BookModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
    edition: optionalNumber(body, "edition"),
    price: optionalNumber(body, "price"),
    storeId: optionalText(body, "storeId"),
    authorIds: ids(body, "authorIds"),
  }
}

export function createAuthor(body: Draft): AuthorModel["createBody"] {
  return {
    name: text(body, "name"),
  }
}

export function updateAuthor(body: Draft): AuthorModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
  }
}

export function createStore(body: Draft): StoreModel["createBody"] {
  return {
    name: text(body, "name"),
  }
}

export function updateStore(body: Draft): StoreModel["updateBody"] {
  return {
    name: optionalText(body, "name"),
  }
}

export async function saveResource(
  key: ResourceKey,
  body: Draft,
  id: string | null,
): Promise<void> {
  switch (key) {
    case "organizations": {
      const { error } =
        id === null
          ? await api.rbac.organizations.post(createOrganization(body))
          : await api.rbac.organizations({ id }).patch(updateOrganization(body))
      if (error) throw error
      return
    }
    case "users": {
      const { error } =
        id === null
          ? await api.rbac.users.post(createUser(body))
          : await api.rbac.users({ id }).patch(updateUser(body))
      if (error) throw error
      return
    }
    case "views": {
      const { error } =
        id === null
          ? await api.rbac.views.post(createView(body))
          : await api.rbac.views({ id }).patch(updateView(body))
      if (error) throw error
      return
    }
    case "roles": {
      const { error } =
        id === null
          ? await api.rbac.roles.post(createRole(body))
          : await api.rbac.roles({ id }).patch(updateRole(body))
      if (error) throw error
      return
    }
    case "permissions": {
      const { error } =
        id === null
          ? await api.rbac.permissions.post(createPermission(body))
          : await api.rbac.permissions({ id }).patch(updatePermission(body))
      if (error) throw error
      return
    }
    case "books": {
      const { error } =
        id === null
          ? await api.book.books.post(createBook(body))
          : await api.book.books({ id }).patch(updateBook(body))
      if (error) throw error
      return
    }
    case "authors": {
      const { error } =
        id === null
          ? await api.book.authors.post(createAuthor(body))
          : await api.book.authors({ id }).patch(updateAuthor(body))
      if (error) throw error
      return
    }
    case "stores": {
      const { error } =
        id === null
          ? await api.book.stores.post(createStore(body))
          : await api.book.stores({ id }).patch(updateStore(body))
      if (error) throw error
      return
    }
    default: {
      const exhaustive: never = key
      throw new Error(`未知资源：${exhaustive}`)
    }
  }
}
