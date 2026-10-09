import { model, prop } from "@ts-grm/core";
import { applyPatches } from "ts-grm-patches";
import { auditFields } from "../embedded.ts";

// 定义任何 model 之前先应用补丁（幂等）。见 model/embedded.ts。
applyPatches();

export const SysUser = model("SysUser", "id", class {
  id = prop.i64().autoIncrement().asString();
  name = prop.text();
  /**
   * `str` 而不是 `text`。两者生成的 DDL **完全一样**（都是 `text`，不会产生
   * 迁移），区别在运行时 scalarType：`prop.text()` 是 TEXT，在 ts-grm 里
   * **根本不能参与 WHERE** —— 连 `email.eq(...)` 都会在建查询时抛
   * `ARGUMENT_ERROR: Cannot create table prop ... TEXT`。
   *
   * 登录要按邮箱查人，所以它必须是 STR。参数 255 只声明意图，DDL 里不出现。
   * 见 docs/constraints.md 第 9 节。
   */
  email = prop.str(255);
  pwdHash = prop.text();
  organization = prop.m2o(SysOrganization);
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});

export const SysOrganization = model("SysOrganization", "id", class {
  id = prop.i64().autoIncrement().asString();
  name = prop.text();
  code = prop.text();
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
  name = prop.text();
  icon = prop.text();
  // Route and component only apply to a VIEW: a MENU is a grouping node and a
  // BUTTON is a permission point, and neither is rendered by a route.
  path = prop.text().nullable();
  componentPath = prop.text().nullable();
  componentName = prop.text().nullable();
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
  name = prop.text();
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
  name = prop.text();
  audit = auditFields;
  deletedAt = prop.dt().nullable();
});
