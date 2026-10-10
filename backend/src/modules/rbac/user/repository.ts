import { dto, type SqlClient } from "@ts-grm/core";
import { client, clientFor, run, transaction } from "../../../model";
import { SysUser } from "../../../model/rbac";
import type { UserModel } from "./model.ts";

/** 对外的字段视图；所属组织按需投影，返回类型由 ts-grm 推导。 */
export const UserView = dto.view(SysUser, (c) => [
  c.id,
  c.name,
  c.email,
  c.organization.with((organization) => [organization.id, organization.name]),
]);

/** 软删除由 model/index.ts 的全局过滤器挡掉，这里不必再写 deleted_at 条件。 */
async function findOne(sql: SqlClient, id: string) {
  // 用 fetchList 取首行，而不用 fetchOptional：后者在 @ts-grm/core@0.0.13 里的
  // 返回类型被写成 `A | B extends true ? ... : null`，实际只推导出 `null`。
  const [row] = await sql
    .createQuery(SysUser, (q, user) => {
      q.where(user.id.eq(id));
      return q.select(user.fetch(UserView));
    })
    .fetchList();
  return row ?? null;
}

export const userRepository = {
  list(limit: number, offset: number) {
    return run(async () => {
      const query = client.createQuery(SysUser, (q, user) => {
        q.orderBy(user.id.asc());
        return q.select(user.fetch(UserView));
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

  create(body: UserModel["createBody"]) {
    return transaction(async (session) => {
      // 口令只存哈希；明文不进数据库，也不出现在任何响应里。
      const pwdHash = await Bun.password.hash(body.password);
      const inserted = await session.query(
        "INSERT INTO sys_user (name, email, pwd_hash, organization_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [body.name, body.email, pwdHash, body.organizationId],
      );
      const created = await findOne(
        clientFor(session),
        String(inserted.rows[0].id),
      );
      if (!created) throw new Error("创建后读取用户失败");
      return created;
    });
  },

  update(id: string, body: UserModel["updateBody"]) {
    return transaction(async (session) => {
      const updated = await session.query(
        `UPDATE sys_user
            SET name = COALESCE($2, name),
                email = COALESCE($3, email),
                organization_id = COALESCE($4, organization_id),
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [
          id,
          body.name ?? null,
          body.email ?? null,
          body.organizationId ?? null,
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
        "UPDATE sys_user SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        [id],
      );
      return result.rowCount !== 0;
    });
  },
};
