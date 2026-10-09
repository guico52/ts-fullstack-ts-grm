import { dto, type SqlClient } from "@ts-grm/core";
import { client, clientFor, run, transaction } from "../../../model";
import { SysOrganization } from "../../../model/rbac";
import type {OrganizationModel} from "./model.ts";

/** 对外的字段视图；返回类型由 ts-grm 推导，不手工拼装。 */
export const OrganizationView = dto.view(SysOrganization, (c) => [c.id, c.name, c.code, c.logo]);

/** 软删除由 model/index.ts 的全局过滤器挡掉，这里不必再写 deleted_at 条件。 */
async function findOne(sql: SqlClient, id: string) {
  // 用 fetchList 取首行，而不用 fetchOptional：后者在 @ts-grm/core@0.0.13 里的
  // 返回类型被写成 `A | B extends true ? ... : null`，实际只推导出 `null`。
  const [row] = await sql
    .createQuery(SysOrganization, (q, organization) => {
      q.where(organization.id.eq(id));
      return q.select(organization.fetch(OrganizationView));
    })
    .fetchList();
  return row ?? null;
}

export const organizationRepository = {
  list(limit: number, offset: number) {
    return run(async () => {
      const query = client.createQuery(SysOrganization, (q, organization) => {
        q.orderBy(organization.id.asc());
        return q.select(organization.fetch(OrganizationView));
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

  create(body: OrganizationModel["createBody"]) {
    return transaction(async (session) => {
      // 主键是数据库自增的 identity 列，不在 INSERT 里提供；用 RETURNING 取回。
      const inserted = await session.query(
        "INSERT INTO sys_organization (name, code, logo) VALUES ($1, $2, $3) RETURNING id",
        [body.name, body.code, body.logo ?? null],
      );
      const created = await findOne(clientFor(session), String(inserted.rows[0].id));
      if (!created) throw new Error("创建后读取组织失败");
      return created;
    });
  },

  update(id: string, body: OrganizationModel["updateBody"]) {
    return transaction(async (session) => {
      // 省略的字段保留原值（COALESCE），显式 null 才置空（CASE 里的布尔开关）。
      const updated = await session.query(
        `UPDATE sys_organization
            SET name = COALESCE($2, name),
                code = COALESCE($3, code),
                logo = CASE WHEN $4 THEN $5 ELSE logo END,
                updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id`,
        [id, body.name ?? null, body.code ?? null, body.logo !== undefined, body.logo ?? null],
      );
      if (updated.rowCount === 0) return null;
      return findOne(clientFor(session), id);
    });
  },

  /** 软删除：置 deleted_at，行保留；全局过滤器会让它从后续查询中消失。 */
  remove(id: string) {
    return transaction(async (session) => {
      const result = await session.query(
        "UPDATE sys_organization SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        [id],
      );
      return result.rowCount !== 0;
    });
  },
};
