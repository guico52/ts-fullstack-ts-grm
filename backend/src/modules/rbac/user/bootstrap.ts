import { transaction } from "../../../model";

export interface AdminSeedOptions {
  email?: string;
  password?: string;
}

/** 首次创建及角色绑定是同一个事务；持久标记不受改名、删除、撤权影响。 */
export async function ensureAdminUser(
  options: AdminSeedOptions = {},
): Promise<void> {
  await transaction(async (session) => {
    // Serialize concurrent startup attempts, including the empty-database case.
    await session.query("SELECT pg_advisory_xact_lock(20261010, 1)");
    const existing = await session.query(
      "SELECT id FROM sys_user WHERE initial_admin = true LIMIT 1",
    );
    if (existing.rowCount) return;
    const email = options.email ?? process.env.ADMIN_EMAIL?.trim();
    const password = options.password ?? process.env.ADMIN_PWD;
    if (!email || !password) {
      console.log("未配置 ADMIN_EMAIL / ADMIN_PWD，跳过管理员初始化。");
      return;
    }
    if (password.length < 6 || password.length > 128)
      throw new Error("ADMIN_PWD 必须为 6–128 个字符");
    const roles = await session.query(
      "SELECT id FROM sys_role WHERE name = '管理员' AND deleted_at IS NULL ORDER BY id LIMIT 1",
    );
    if (!roles.rowCount) throw new Error("请先 seed 管理员角色");
    const organizations = await session.query(
      "SELECT id FROM sys_organization WHERE deleted_at IS NULL ORDER BY id LIMIT 1",
    );
    const organizationId =
      organizations.rows[0]?.id ??
      (
        await session.query(
          "INSERT INTO sys_organization (name, code) VALUES ('默认组织', 'DEFAULT') RETURNING id",
        )
      ).rows[0].id;
    const hash = await Bun.password.hash(password);
    const created = await session.query(
      "INSERT INTO sys_user (name, email, pwd_hash, organization_id, initial_admin) VALUES ('admin', $1, $2, $3, true) RETURNING id",
      [email, hash, organizationId],
    );
    await session.query(
      "INSERT INTO sys_role_user_mapping (role_id, user_id) VALUES ($1, $2)",
      [roles.rows[0].id, created.rows[0].id],
    );
    console.log(`已创建初始管理员：${email}`);
  });
}
