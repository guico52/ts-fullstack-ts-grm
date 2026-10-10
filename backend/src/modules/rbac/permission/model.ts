import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const code = t.String({ minLength: 1, maxLength: 255, pattern: "^\\S+$" });
const url = t.Union([t.String({ minLength: 1, maxLength: 1024, pattern: "^/" }), t.Null()]);
const method = t.Union([
  t.Union([t.Literal("GET"), t.Literal("POST"), t.Literal("PUT"), t.Literal("PATCH"), t.Literal("DELETE"), t.Literal("HEAD"), t.Literal("OPTIONS")]),
  t.Null(),
]);

const entity = t.Object({ id, code, url, method: t.Union([t.String({ maxLength: 16 }), t.Null()]), deprecated: t.Boolean() });

export const PermissionModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
  createBody: t.Object({ code, url: t.Optional(url), method: t.Optional(method), deprecated: t.Optional(t.Boolean()) }, { additionalProperties: false }),
  updateBody: t.Object(
    { code: t.Optional(code), url: t.Optional(url), method: t.Optional(method), deprecated: t.Optional(t.Boolean()) },
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

export type PermissionModel = {
  [K in keyof typeof PermissionModel]: UnwrapSchema<(typeof PermissionModel)[K]>;
};
