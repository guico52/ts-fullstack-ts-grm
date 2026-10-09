import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const name = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });
const code = t.String({ minLength: 1, maxLength: 64, pattern: "\\S" });
const logo = t.Union([t.String({ maxLength: 255 }), t.Null()]);

const entity = t.Object({ id, name, code, logo });

export const OrganizationModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
  createBody: t.Object(
    { name, code, logo: t.Optional(logo) },
    { additionalProperties: false },
  ),
  updateBody: t.Object(
    { name: t.Optional(name), code: t.Optional(code), logo: t.Optional(logo) },
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

export type OrganizationModel = {
  [K in keyof typeof OrganizationModel]: UnwrapSchema<(typeof OrganizationModel)[K]>;
};
