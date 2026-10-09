import { model, prop } from "@ts-grm/core";
import { applyPatches } from "ts-grm-patches";
import { auditFields } from "../embedded.ts";

// 定义任何 model 之前先应用补丁（幂等）。见 model/embedded.ts。
applyPatches();

export const SysUser = model("SysUser", "id", class {
  id = prop.i64().autoIncrement().asString();
  name = prop.text();
  email = prop.text();
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
  path = prop.text();
  componentPath = prop.text();
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
