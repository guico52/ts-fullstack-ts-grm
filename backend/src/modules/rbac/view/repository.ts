import { dto, type SqlClient } from "@ts-grm/core";
import type { PoolClient } from "pg";
import { client, clientFor, run, transaction } from "../../../model";
import { SysView } from "../../../model/rbac";
import type { ViewModel } from "./model.ts";

/**
 * 对外的字段视图。`parentId` 是 ts-grm 为 m2o 关联自动生成的引用键成员，
 * 直接取它即可，不必把父节点整个展平。
 */
export const ViewView = dto.view(SysView, (c) => [
  c.id,
  c.name,
  c.icon,
  c.path,
  c.componentPath,
  c.componentName,
  c.sort,
  c.active,
  c.type,
  c.parentId,
]);

/** 软删除由 model/index.ts 的全局过滤器挡掉，这里不必再写 deleted_at 条件。 */
async function findOne(sql: SqlClient, id: string) {
  // 用 fetchList 取首行，而不用 fetchOptional：后者在 @ts-grm/core@0.0.13 里的
  // 返回类型被写成 `A | B extends true ? ... : null`，实际只推导出 `null`。
  const [row] = await sql
    .createQuery(SysView, (q, view) => {
      q.where(view.id.eq(id));
      return q.select(view.fetch(ViewView));
    })
    .fetchList();
  return row ?? null;
}

const COLUMNS = "name, icon, path, component_path, component_name, sort, active, type, parent_id";

/**
 * Where a new row lands among its siblings: 1 for the first, then max + 1.
 *
 * Computed inside the same transaction as the insert, so two rows created at
 * once for the same parent cannot both read the same maximum and collide.
 * `IS NOT DISTINCT FROM` is what makes it work for top-level rows too, where
 * the parent is NULL — `parent_id = NULL` would match nothing.
 */
async function nextSortNumber(session: PoolClient, parentId: string | null): Promise<number> {
  const result = await session.query<{ next: string }>(
    `SELECT COALESCE(MAX(sort), 0) + 1 AS next
       FROM sys_view
      WHERE deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM $1`,
    [parentId],
  );
  return Number(result.rows[0]?.next ?? 1);
}

export const viewRepository = {
  list(limit: number, offset: number, parentId?: string) {
    return run(async () => {
      const query = client.createQuery(SysView, (q, view) => {
        if (parentId !== undefined) q.where(view.parentId.eq(parentId));
        q.orderBy(view.sort.asc(), view.id.asc());
        return q.select(view.fetch(ViewView));
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

  create(body: ViewModel["createBody"]) {
    return transaction(async (session) => {
      // An explicit sort wins; otherwise the row goes to the end of its level.
      const parentId = body.parentId ?? null;
      const sort = body.sort ?? (await nextSortNumber(session, parentId));

      const inserted = await session.query(
        `INSERT INTO sys_view (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          body.name,
          body.icon,
          body.path ?? null,
          body.componentPath ?? null,
          body.componentName ?? null,
          sort,
          body.active ?? true,
          body.type,
          parentId,
        ],
      );
      const created = await findOne(clientFor(session), String(inserted.rows[0].id));
      if (!created) throw new Error("创建后读取视图失败");
      return created;
    });
  },

  update(id: string, body: ViewModel["updateBody"]) {
    return transaction(async (session) => {
      // 省略的字段保留原值（COALESCE），可空外键显式 null 才置空（CASE 布尔开关）。
      const updated = await session.query(
        `UPDATE sys_view
            SET name = COALESCE($2, name),
                icon = COALESCE($3, icon),
                path = CASE WHEN $4 THEN $5 ELSE path END,
                component_path = CASE WHEN $6 THEN $7 ELSE component_path END,
                component_name = CASE WHEN $8 THEN $9 ELSE component_name END,
                sort = COALESCE($10, sort),
                active = COALESCE($11, active),
                type = COALESCE($12, type),
                parent_id = CASE WHEN $13 THEN $14 ELSE parent_id END,
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [
          id,
          body.name ?? null,
          body.icon ?? null,
          body.path !== undefined,
          body.path ?? null,
          body.componentPath !== undefined,
          body.componentPath ?? null,
          body.componentName !== undefined,
          body.componentName ?? null,
          body.sort ?? null,
          body.active ?? null,
          body.type ?? null,
          body.parentId !== undefined,
          body.parentId ?? null,
        ],
      );
      if (updated.rowCount === 0) return null;
      return findOne(clientFor(session), id);
    });
  },

  /** 软删除：置 deleted_at，行保留；全局过滤器会让它从后续查询中消失。 */
  remove(id: string) {
    return transaction(async (session) => {
      const result = await session.query(
        "UPDATE sys_view SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        [id],
      );
      return result.rowCount !== 0;
    });
  },
};
