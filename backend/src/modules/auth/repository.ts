import { dto } from "@ts-grm/core";
import { client, run, transaction } from "../../model";
import { SysUser } from "../../model/rbac";

/**
 * 登录要读 `pwdHash`，所以不能复用 `UserView` —— 那个视图刻意不含哈希。
 * 这个视图只在本模块内使用，**没有任何路由把它返回给调用方**。
 */
const CredentialsView = dto.view(SysUser, (c) => [
  c.id,
  c.name,
  c.email,
  c.pwdHash,
  c.tokenVersion,
  c.mustChangePassword,
]);

const ProfileView = dto.view(SysUser, (c) => [
  c.id, c.name, c.email, c.mustChangePassword,
  c.organization.with((organization) => [organization.id, organization.name]),
  c.roles.with((role) => [role.id, role.name]),
]);

export const authRepository = {
  profile(id: string) {
    return run(async () => {
      const [row] = await client.createQuery(SysUser, (q, user) => {
        q.where(user.id.eq(id));
        return q.select(user.fetch(ProfileView));
      }).fetchList();
      return row ?? null;
    });
  },
  findById(id: string) {
    return run(async () => {
      const [row] = await client
        .createQuery(SysUser, (q, user) => {
          q.where(user.id.eq(id));
          return q.select(user.fetch(CredentialsView));
        })
        .fetchList();
      return row ?? null;
    });
  },
  /** Atomic version increment invalidates all previously issued JWTs. */
  replacePassword(
    id: string,
    hash: string,
    mustChange: boolean,
    expectedVersion?: number,
  ) {
    return transaction(async (session) => {
      const result = await session.query(
        `UPDATE sys_user SET pwd_hash = $2, token_version = token_version + 1,
         must_change_password = $3, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         AND ($4::integer IS NULL OR token_version = $4) RETURNING id`,
        [id, hash, mustChange, expectedVersion ?? null],
      );
      return Boolean(result.rowCount);
    });
  },
  /**
   * 按邮箱找一行凭据。
   *
   * **这里不做口令比对。** repository 只负责把行取出来；"这个口令对不对"
   * 是规则，属于 service。
   *
   * 邮箱**按原样精确匹配**。看起来很自然的 `user.email.lower().eq(...)` 会在
   * 建查询时抛 `ARGUMENT_ERROR: Cannot create table prop ... TEXT`：
   * `prop.text()` 在 ts-grm 里是 **TEXT** 不是 **STR**，拿不到 `lower()` /
   * `ilike()` 这些字符串表达式。大小写规范化应该发生在**写入侧**（注册时
   * 存成小写），不是靠查询兜。见 docs/constraints.md 第 9 节。
   *
   * 软删除由全局过滤器挡掉 —— 被停用的账号查不到，于是和"口令错了"
   * 走到同一个分支。
   */
  findByEmail(email: string) {
    return run(async () => {
      const [row] = await client
        .createQuery(SysUser, (q, user) => {
          q.where(user.email.eq(email.trim()));
          return q.select(user.fetch(CredentialsView));
        })
        .fetchList();
      return row ?? null;
    });
  },
};
