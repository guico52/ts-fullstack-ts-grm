import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const name = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });
const linkIds = t.Array(id, { maxItems: 500, uniqueItems: true });

/** 关联只回 id 列表，避免把整棵用户/视图/权限图带出来。 */
const links = t.Array(t.Object({ id }));

const entity = t.Object({
  id,
  name,
  users: links,
  views: links,
  permissions: links,
});

export const RoleModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
  createBody: t.Object(
    {
      name,
      userIds: t.Optional(linkIds),
      viewIds: t.Optional(linkIds),
      permissionIds: t.Optional(linkIds),
    },
    { additionalProperties: false },
  ),
  updateBody: t.Object(
    {
      name: t.Optional(name),
      userIds: t.Optional(linkIds),
      viewIds: t.Optional(linkIds),
      permissionIds: t.Optional(linkIds),
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

export type RoleModel = {
  [K in keyof typeof RoleModel]: UnwrapSchema<(typeof RoleModel)[K]>;
};
