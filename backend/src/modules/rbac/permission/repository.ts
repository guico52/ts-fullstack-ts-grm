import { dto, type SqlClient } from "@ts-grm/core";
import { client, clientFor, run, transaction } from "../../../model";
import { SysPermission } from "../../../model/rbac";
import type { PermissionModel } from "./model.ts";

/** 对外的字段视图；返回类型由 ts-grm 推导，不手工拼装。 */
export const PermissionView = dto.view(SysPermission, (c) => [c.id, c.code, c.url, c.method, c.deprecated]);

/** 软删除由 model/index.ts 的全局过滤器挡掉，这里不必再写 deleted_at 条件。 */
async function findOne(sql: SqlClient, id: string) {
  // 用 fetchList 取首行，而不用 fetchOptional：后者在 @ts-grm/core@0.0.13 里的
  // 返回类型被写成 `A | B extends true ? ... : null`，实际只推导出 `null`。
  const [row] = await sql
    .createQuery(SysPermission, (q, permission) => {
      q.where(permission.id.eq(id));
      return q.select(permission.fetch(PermissionView));
    })
    .fetchList();
  return row ?? null;
}

export const permissionRepository = {
  list(limit: number, offset: number) {
    return run(async () => {
      const query = client.createQuery(SysPermission, (q, permission) => {
        q.orderBy(permission.id.asc());
        return q.select(permission.fetch(PermissionView));
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

  create(body: PermissionModel["createBody"]) {
    return transaction(async (session) => {
      // 主键是数据库自增的 identity 列，不在 INSERT 里提供；用 RETURNING 取回。
      const inserted = await session.query(
        "INSERT INTO sys_permission (code, url, method, deprecated) VALUES ($1, $2, $3, $4) RETURNING id",
        [body.code, body.url ?? null, body.method ?? null, body.deprecated ?? false],
      );
      const created = await findOne(clientFor(session), String(inserted.rows[0].id));
      if (!created) throw new Error("创建后读取权限失败");
      return created;
    });
  },

  update(id: string, body: PermissionModel["updateBody"]) {
    return transaction(async (session) => {
      // 省略的字段保留原值（COALESCE）。
      const updated = await session.query(
        `UPDATE sys_permission
            SET code = COALESCE($2, code),
                url = CASE WHEN $3 THEN $4 ELSE url END,
                method = CASE WHEN $5 THEN $6 ELSE method END,
                deprecated = COALESCE($7, deprecated),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, body.code ?? null, body.url !== undefined, body.url ?? null, body.method !== undefined, body.method ?? null, body.deprecated ?? null],
      );
      if (updated.rowCount === 0) return null;
      return findOne(clientFor(session), id);
    });
  },

  /** 软删除：置 deleted_at，行保留；全局过滤器会让它从后续查询中消失。 */
  remove(id: string) {
    return transaction(async (session) => {
      const result = await session.query(
        "UPDATE sys_permission SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        [id],
      );
      return result.rowCount !== 0;
    });
  },
};
