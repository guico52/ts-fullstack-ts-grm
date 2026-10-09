import { t, type UnwrapSchema } from "elysia";

// 主键是 i64，以字符串进出前端；pattern 由框架统一校验。
const id = t.String({ pattern: "^\\d+$" });
const name = t.String({ minLength: 1, maxLength: 50, pattern: "\\S" });

/**
 * 只暴露自身字段。`BookStore.books` 是反向一对多，写入走图书的 `storeId`
 * （见 `modules/book/book/repository.ts`），这里不重复暴露一份。
 */
const entity = t.Object({ id, name });

export const StoreModel = {
  idParam: t.Object({ id }),
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
    offset: t.Optional(t.Numeric({ minimum: 0, multipleOf: 1 })),
  }),
  createBody: t.Object({ name }, { additionalProperties: false }),
  updateBody: t.Object(
    { name: t.Optional(name) },
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

export type StoreModel = {
  [K in keyof typeof StoreModel]: UnwrapSchema<(typeof StoreModel)[K]>;
};
