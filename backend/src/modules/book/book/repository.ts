import { dto, type SqlClient } from "@ts-grm/core";
import type { PoolClient } from "pg";
import { client, clientFor, run, transaction } from "../../../model";
import { Book } from "../../../model/book";
import type { BookModel } from "./model.ts";

/** 对外的字段视图：所属书店与作者各投影 id + 名称。 */
export const BookView = dto.view(Book, (c) => [
  c.id,
  c.name,
  c.edition,
  c.price,
  c.store.with((store) => [store.id, store.name]),
  c.authors.with((author) => [author.id, author.name]),
]);

/** 软删除由 model/index.ts 的全局过滤器挡掉，这里不必再写 deleted_at 条件。 */
async function findOne(sql: SqlClient, id: string) {
  // 用 fetchList 取首行，而不用 fetchOptional：后者在 @ts-grm/core@0.0.13 里的
  // 返回类型被写成 `A | B extends true ? ... : null`，实际只推导出 `null`。
  const [row] = await sql
    .createQuery(Book, (q, book) => {
      q.where(book.id.eq(id));
      return q.select(book.fetch(BookView));
    })
    .fetchList();
  return row ?? null;
}

/**
 * 整体替换作者关联。中间表名与列名来自本文件的常量，不来自请求，所以可以
 * 安全地拼进 SQL；值一律走参数。
 */
async function replaceAuthors(
  session: PoolClient,
  bookId: string,
  ids: readonly string[],
) {
  await session.query("DELETE FROM book_author_mapping WHERE book_id = $1", [bookId]);
  if (ids.length) {
    await session.query(
      "INSERT INTO book_author_mapping (book_id, author_id) SELECT $1, unnest($2::bigint[])",
      [bookId, ids],
    );
  }
}

export const bookRepository = {
  list(limit: number, offset: number) {
    return run(async () => {
      const query = client.createQuery(Book, (q, book) => {
        q.orderBy(book.id.asc());
        return q.select(book.fetch(BookView));
      });
      const [data, total] = await Promise.all([
        query.fetchRange({ limit, offset }),
        query.fetchCount(),
      ]);
      return { data, total, limit, offset };
    });
  },

  find(id: string) {
    return run(() => findOne(client, id));
  },

  create(body: BookModel["createBody"]) {
    return transaction(async (session) => {
      // 主键是数据库自增的 identity 列，不在 INSERT 里提供；用 RETURNING 取回。
      const inserted = await session.query(
        "INSERT INTO book (name, edition, price, store_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [body.name, body.edition, body.price, body.storeId],
      );
      const id = String(inserted.rows[0].id);
      if (body.authorIds?.length) {
        await replaceAuthors(session, id, body.authorIds);
      }
      const created = await findOne(clientFor(session), id);
      if (!created) throw new Error("创建后读取图书失败");
      return created;
    });
  },

  update(id: string, body: BookModel["updateBody"]) {
    return transaction(async (session) => {
      // 省略的字段保留原值；store_id 是 NOT NULL，没有「置空」这一态。
      const updated = await session.query(
        `UPDATE book
            SET name = COALESCE($2, name),
                edition = COALESCE($3, edition),
                price = COALESCE($4, price),
                store_id = COALESCE($5, store_id),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, body.name ?? null, body.edition ?? null, body.price ?? null, body.storeId ?? null],
      );
      if (updated.rowCount === 0) return null;
      // 提供了就整体替换，未提供则保留原有作者。
      if (body.authorIds !== undefined) {
        await replaceAuthors(session, id, body.authorIds);
      }
      return findOne(clientFor(session), id);
    });
  },

  /** 软删除：置 deleted_at，行与作者关联保留；全局过滤器会让它从后续查询中消失。 */
  remove(id: string) {
    return transaction(async (session) => {
      const result = await session.query(
        "UPDATE book SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        [id],
      );
      return result.rowCount !== 0;
    });
  },
};
