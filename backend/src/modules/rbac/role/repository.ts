import { dto, type SqlClient } from "@ts-grm/core";
import type { PoolClient } from "pg";
import { client, clientFor, run, transaction } from "../../../model";
import { SysRole } from "../../../model/rbac";
import type { RoleModel } from "./model.ts";

/** 对外的字段视图；三个多对多关联只投影 id。 */
export const RoleView = dto.view(SysRole, (c) => [
  c.id,
  c.name,
  c.users.with((user) => [user.id]),
  c.views.with((view) => [view.id]),
  c.permissions.with((permission) => [permission.id]),
]);

/** 软删除由 model/index.ts 的全局过滤器挡掉，这里不必再写 deleted_at 条件。 */
async function findOne(sql: SqlClient, id: string) {
  // 用 fetchList 取首行，而不用 fetchOptional：后者在 @ts-grm/core@0.0.13 里的
  // 返回类型被写成 `A | B extends true ? ... : null`，实际只推导出 `null`。
  const [row] = await sql
    .createQuery(SysRole, (q, role) => {
      q.where(role.id.eq(id));
      return q.select(role.fetch(RoleView));
    })
    .fetchList();
  return row ?? null;
}

/**
 * 整体替换某个关联表的内容。中间表名与列名来自本文件的常量，不来自请求，
 * 所以可以安全地拼进 SQL；值一律走参数。
 */
async function replaceLinks(
  session: PoolClient,
  table:
    | "sys_role_user_mapping"
    | "sys_role_view_mapping"
    | "sys_role_permission_mapping",
  column: "user_id" | "view_id" | "permission_id",
  roleId: string,
  ids: readonly string[],
) {
  await session.query(`DELETE FROM ${table} WHERE role_id = $1`, [roleId]);
  if (ids.length) {
    await session.query(
      `INSERT INTO ${table} (role_id, ${column}) SELECT $1, unnest($2::bigint[])`,
      [roleId, ids],
    );
  }
}

export const roleRepository = {
  list(limit: number, offset: number) {
    return run(async () => {
      const query = client.createQuery(SysRole, (q, role) => {
        q.orderBy(role.id.asc());
        return q.select(role.fetch(RoleView));
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

  create(body: RoleModel["createBody"]) {
    return transaction(async (session) => {
      const inserted = await session.query(
        "INSERT INTO sys_role (name) VALUES ($1) RETURNING id",
        [body.name],
      );
      const id = String(inserted.rows[0].id);
      if (body.userIds?.length) {
        await replaceLinks(
          session,
          "sys_role_user_mapping",
          "user_id",
          id,
          body.userIds,
        );
      }
      if (body.viewIds?.length) {
        await replaceLinks(
          session,
          "sys_role_view_mapping",
          "view_id",
          id,
          body.viewIds,
        );
      }
      if (body.permissionIds?.length) {
        await replaceLinks(
          session,
          "sys_role_permission_mapping",
          "permission_id",
          id,
          body.permissionIds,
        );
      }
      const created = await findOne(clientFor(session), id);
      if (!created) throw new Error("创建后读取角色失败");
      return created;
    });
  },

  update(id: string, body: RoleModel["updateBody"]) {
    return transaction(async (session) => {
      const updated = await session.query(
        `UPDATE sys_role
            SET name = COALESCE($2, name),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, body.name ?? null],
      );
      if (updated.rowCount === 0) return null;
      // 提供了就整体替换，未提供则保留原有关联。
      if (body.userIds !== undefined) {
        await replaceLinks(
          session,
          "sys_role_user_mapping",
          "user_id",
          id,
          body.userIds,
        );
      }
      if (body.viewIds !== undefined) {
        await replaceLinks(
          session,
          "sys_role_view_mapping",
          "view_id",
          id,
          body.viewIds,
        );
      }
      if (body.permissionIds !== undefined) {
        await replaceLinks(
          session,
          "sys_role_permission_mapping",
          "permission_id",
          id,
          body.permissionIds,
        );
      }
      return findOne(clientFor(session), id);
    });
  },

  /** 软删除：置 deleted_at，行与关联保留；全局过滤器会让它从后续查询中消失。 */
  remove(id: string) {
    return transaction(async (session) => {
      const result = await session.query(
        "UPDATE sys_role SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        [id],
      );
      return result.rowCount !== 0;
    });
  },
};
