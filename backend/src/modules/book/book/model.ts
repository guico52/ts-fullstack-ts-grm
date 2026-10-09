import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const name = t.String({ minLength: 1, maxLength: 50, pattern: "\\S" });
const edition = t.Integer({ minimum: 1, maximum: 9999 });
// numeric(10, 2)：10 位有效数字里留 2 位小数。
const price = t.Number({ minimum: 0, maximum: 99_999_999.99 });
const authorIds = t.Array(id, { maxItems: 200, uniqueItems: true });

/** 所属书店只暴露 id 与名称，书与作者同理——不外泄整棵关联图。 */
const entity = t.Object({
  id,
  name,
  edition,
  price,
  /**
   * **可能为 null**：书店被软删除后，全局过滤器也会把它从关联查询里
   * 滤掉，于是这里读出来是 null。
   *
   * `store_id` 列本身是 NOT NULL 且无法置空（写入时不允许），所以
   * null 只意味着“指向的书店已经不在”，不意味着这本书没有书店。
   */
  store: t.Union([t.Object({ id, name: t.String() }), t.Null()]),
  /**
   * 数组本身不会是 null，但已软删除的作者会从里面消失——
   * 关联查询同样被全局过滤器管着。
   */
  authors: t.Array(t.Object({ id, name: t.String() })),
});

export const BookModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
  createBody: t.Object(
    {
      name,
      edition,
      price,
      // 列是 NOT NULL，所以必填。
      storeId: id,
      authorIds: t.Optional(authorIds),
    },
    { additionalProperties: false },
  ),
  updateBody: t.Object(
    {
      name: t.Optional(name),
      edition: t.Optional(edition),
      price: t.Optional(price),
      storeId: t.Optional(id),
      authorIds: t.Optional(authorIds),
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

export type BookModel = {
  [K in keyof typeof BookModel]: UnwrapSchema<(typeof BookModel)[K]>;
};
