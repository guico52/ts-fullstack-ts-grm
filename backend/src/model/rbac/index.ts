import { model, prop } from "@ts-grm/core";
import { applyPatches } from "ts-grm-patches";
import { auditFields } from "../embedded.ts";

// 定义任何 model 之前先应用补丁（幂等）。见 model/embedded.ts。
applyPatches();

/**
 * 字符串列有两种写法，选哪个只看一件事：**这一列会不会被用来找某一行**
 * （也就是出现在 WHERE / ORDER BY 里）。
 *
 * - `prop.str(n)` → scalarType 是 STR，能构造表达式，可查可排序。
 * - `prop.text()` → scalarType 是 TEXT，在 ts-grm 0.0.13 里**连 `eq` 都不行**，
 *   一进查询就抛 `ARGUMENT_ERROR: Cannot create table prop ... is TEXT`。
 *
 * 两者生成的 DDL **完全一样**（PostgreSQL 方言下都是 `text`），所以改这一条
 * **不产生迁移**；`n` 也不进 DDL，取值以 Elysia schema 的 `maxLength` 为准 ——
 * 让"能存多长"只有一处说法。
 *
 * 反过来，**刻意不需要比较**的列保持 `text()`，并在下面逐列注明理由：
 * 否则下一个人分不清那是设计还是漏改。详见 docs/constraints.md 第 9 节。
 */

export const SysUser = model("SysUser", "id", class {
  id = prop.i64().autoIncrement().asString();
  /** 显示名可查可排序；管理员初始化使用持久 initialAdmin 标记。 */
  name = prop.str(100);
  /** 登录按邮箱查人，见 modules/auth/repository.ts。 */
  email = prop.str(255);
  /** 只被读出来、交给 `Bun.password.verify` 比对 —— **比对发生在应用层**，
   * SQL 里永远不会出现 `pwd_hash = ...`，所以它不需要可查询：保持 `text()`。
   */
  pwdHash = prop.text();
  tokenVersion = prop.i32().default(0);
  mustChangePassword = prop.bool().default(false);
  /** 持久初始化标记：改名、软删除或撤销角色都不会重新初始化。 */
  initialAdmin = prop.bool().default(false);
  organization = prop.m2o(SysOrganization);
  /**
   * `SysRole.users` 的反向。不新增列——它复用同一张中间表，所以**不产生迁移**。
   *
   * 直接传 `SysRole` 而**不是** `() => SysRole`：lambda 形式只允许用于自关联，
   * 对其他模型会报 `Illegal property ... Lambda argument can only be used for
   * recursive associations`。引用在后面定义的模型是可以的（与
   * `organization = prop.m2o(SysOrganization)` 同理）。
   *
   * 有了它，“这个用户能访问什么”就能从用户侧一次查出来（见
   * modules/auth/access.ts），不必按关联条件去筛角色。
   */
  roles = prop.m2m(SysRole).mappedBy("users");
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const SysOrganization = model("SysOrganization", "id", class {
  id = prop.i64().autoIncrement().asString();
  /** 显示名，会用于排序与搜索。 */
  name = prop.str(100);
  /** 编码是这一行的业务标识，迟早要按它找。 */
  code = prop.str(64);
  /** 一个 URL，从不作为查询条件 —— 保持 `text()`。 */
  logo = prop.text().nullable();
  users = prop.o2m(SysUser).mappedBy("organization");
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const SysViewTypeEnum = {
  MENU: "MENU",
  VIEW: "VIEW",
  BUTTON: "BUTTON",
};

export const SysView = model("SysView", "id", class {
  id = prop.i64().autoIncrement().asString();
  /** 显示名，会用于排序与搜索。 */
  name = prop.str(100);
  /** 按图标筛选视图是迟早的事。 */
  icon = prop.str(100);
  // Route and component only apply to a VIEW: a MENU is a grouping node and a
  // BUTTON is a permission point, and neither is rendered by a route.
  /** 路由就是用来定位页面的，必须可查。 */
  path = prop.str(255).nullable();
  /** 按组件反查有哪些页面用它。 */
  componentPath = prop.str(255).nullable();
  /** 同上，按组件名反查。 */
  componentName = prop.str(100).nullable();
  sort = prop.i32();
  active = prop.bool().default(true);
  type = prop.enum(SysViewTypeEnum);
  parent = prop.m2o(() => SysView);
  children = prop.o2m(() => SysView).mappedBy("parent");
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const SysRole = model("SysRole", "id", class {
  id = prop.i64().autoIncrement().asString();
  /** 显示名，会用于排序与搜索。 */
  name = prop.str(100);
  users = prop.m2m(SysUser).joinTable({
    name: "sys_role_user_mapping",
    joinThisColumns: ["role_id"],
    joinTargetColumns: ["user_id"],
  });
  views = prop.m2m(SysView).joinTable({
    name: "sys_role_view_mapping",
    joinThisColumns: ["role_id"],
    joinTargetColumns: ["view_id"],
  });
  permissions = prop.m2m(SysPermission).joinTable({
    name: "sys_role_permission_mapping",
    joinThisColumns: ["role_id"],
    joinTargetColumns: ["permission_id"],
  });
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const SysPermission = model("SysPermission", "id", class {
  id = prop.i64().autoIncrement().asString();
  /** 后端托管的权限标识；角色关系仍绑定 id。 */
  code = prop.str(255);
  /** 已有权限尚未绑定接口时两者均为空，托管同步时补齐。 */
  url = prop.str(1024).nullable();
  method = prop.str(16).nullable();
  /** 废弃不等于删除；角色关联保留，但不再参与有效授权。 */
  deprecated = prop.bool().default(false);
  audit = auditFields;
  deletedAt = prop.dt().nullable();
}, (ctx) => {
  ctx.unique("code");
  ctx.unique("url", "method");
});
