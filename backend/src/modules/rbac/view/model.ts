import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const name = t.String({ minLength: 1, maxLength: 100, pattern: "\\S" });
const icon = t.String({ maxLength: 100 });
const path = t.Union([t.String({ minLength: 1, maxLength: 255, pattern: "\\S" }), t.Null()]);
const componentPath = t.Union([t.String({ maxLength: 255 }), t.Null()]);
const componentName = t.Union([t.String({ minLength: 1, maxLength: 100, pattern: "\\S" }), t.Null()]);
const sort = t.Integer({ minimum: 0, maximum: 100_000 });
const active = t.Boolean();
// 与模型里的 SysViewTypeEnum 保持一致。
const type = t.Union([t.Literal("MENU"), t.Literal("VIEW"), t.Literal("BUTTON")]);
const parentId = t.Union([id, t.Null()]);

const entity = t.Object({ id, name, icon, path, componentPath, componentName, sort, active, type, parentId });

export const ViewModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
    // 只看某个父节点下的直接子节点。
    parentId: t.Optional(id),
  }),
  createBody: t.Object(
    {
      name,
      icon,
      path: t.Optional(path),
      componentPath: t.Optional(componentPath),
      componentName: t.Optional(componentName),
      type,
      sort: t.Optional(sort),
      active: t.Optional(active),
      parentId: t.Optional(parentId),
    },
    { additionalProperties: false },
  ),
  updateBody: t.Object(
    {
      name: t.Optional(name),
      icon: t.Optional(icon),
      path: t.Optional(path),
      componentPath: t.Optional(componentPath),
      componentName: t.Optional(componentName),
      type: t.Optional(type),
      sort: t.Optional(sort),
      active: t.Optional(active),
      parentId: t.Optional(parentId),
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

export type ViewModel = {
  [K in keyof typeof ViewModel]: UnwrapSchema<(typeof ViewModel)[K]>;
};
