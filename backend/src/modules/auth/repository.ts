import { dto } from "@ts-grm/core";
import { client, run } from "../../model";
import { SysUser } from "../../model/rbac";

/**
 * 登录要读 `pwdHash`，所以不能复用 `UserView` —— 那个视图刻意不含哈希。
 * 这个视图只在本模块内使用，**没有任何路由把它返回给调用方**。
 */
const CredentialsView = dto.view(SysUser, (c) => [c.id, c.name, c.email, c.pwdHash]);

export const authRepository = {
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
