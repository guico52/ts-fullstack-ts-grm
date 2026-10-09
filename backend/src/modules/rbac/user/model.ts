import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const name = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });
const email = t.String({ minLength: 3, maxLength: 255, pattern: "^\\S+@\\S+$" });
const password = t.String({ minLength: 6, maxLength: 128 });

const entity = t.Object({
  id,
  name,
  email,
  /**
   * 所属组织只暴露 id 与名称，不外泄组织的其余字段。
   *
   * **可能为 null**：组织被软删除后，全局过滤器也会把它从关联查询里
   * 滤掉，于是这里读出来是 null。契约写清楚这一点，而不是让类型说谎
   * （实测：软删组织后 GET /rbac/users/:id 返回 organization: null）。
   */
  organization: t.Union([t.Object({ id, name: t.String() }), t.Null()]),
});

export const UserModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
  createBody: t.Object(
    {
      name,
      email,
      password,
      // 列是 NOT NULL，所以必填。
      organizationId: id,
    },
    { additionalProperties: false },
  ),
  updateBody: t.Object(
    {
      name: t.Optional(name),
      email: t.Optional(email),
      password: t.Optional(password),
      organizationId: t.Optional(id),
    },
    { minProperties: 1, additionalProperties: false },
  ),
  entity,
  list: t.Object({
    data: t.Array(entity),
    total: t.Integer(),
    limit: t.Integer(),
    offset: t.Integer(),
  }),
  deleted: t.Object({ id, deleted: t.Literal(true) }),
} as const;

export type UserModel = {
  [K in keyof typeof UserModel]: UnwrapSchema<(typeof UserModel)[K]>;
};
