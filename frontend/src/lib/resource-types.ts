/** 资源契约直接来自后端 schema；展示层只允许已声明字段。 */
import type { OrganizationModel } from "../../../backend/src/modules/rbac/organization/model"
import type { UserModel } from "../../../backend/src/modules/rbac/user/model"
import type { ViewModel } from "../../../backend/src/modules/rbac/view/model"
import type { RoleModel } from "../../../backend/src/modules/rbac/role/model"
import type { PermissionModel } from "../../../backend/src/modules/rbac/permission/model"
import type { BookModel } from "../../../backend/src/modules/book/book/model"
import type { AuthorModel } from "../../../backend/src/modules/book/author/model"
import type { StoreModel } from "../../../backend/src/modules/book/store/model"

export interface ResourceEntities {
  organizations: OrganizationModel["entity"]
  users: UserModel["entity"]
  views: ViewModel["entity"]
  roles: RoleModel["entity"]
  permissions: PermissionModel["entity"]
  books: BookModel["entity"]
  authors: AuthorModel["entity"]
  stores: StoreModel["entity"]
}

export type ResourceKey = keyof ResourceEntities

type KeysOfUnion<T> = T extends T ? keyof T : never
type ValueOfUnion<T, K extends PropertyKey> = T extends T
  ? K extends keyof T
    ? T[K]
    : never
  : never

type Entity = ResourceEntities[ResourceKey]
/** 共享表格接受实体的字段投影；每个字段保留 schema 的具体类型。 */
export type ResourceRow = {
  [K in KeysOfUnion<Entity>]?: ValueOfUnion<Entity, K>
}

export type ResourceRowValue = ResourceRow[keyof ResourceRow]

type CreateBody =
  | OrganizationModel["createBody"]
  | UserModel["createBody"]
  | ViewModel["createBody"]
  | RoleModel["createBody"]
  | PermissionModel["createBody"]
  | BookModel["createBody"]
  | AuthorModel["createBody"]
  | StoreModel["createBody"]

/** 输入控件只产生标量或关联 ID 数组；数字输入在归一化前可以是字符串。 */
export type FormFieldValue = string | number | boolean | null | undefined | string[]
export type ResourceFormValues = Partial<Record<KeysOfUnion<CreateBody>, FormFieldValue>>
