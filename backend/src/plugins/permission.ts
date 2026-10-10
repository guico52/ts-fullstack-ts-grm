import { Elysia, type InferContext } from "elysia";
import { accessRepository } from "../modules/auth/access.ts";
import { authGuard, type AuthGuardType } from "./auth.ts";
import { PermissionCatalog, permissionCatalogPlugin, type PermissionCatalogOptions } from "./permission-catalog.ts";

type PermissionCheckContext = Pick<InferContext<AuthGuardType>, "request" | "route" | "status">
  & Partial<Pick<InferContext<AuthGuardType>, "user">>;

/** 上下文由登录插件推导，包含验证后的 user，不能用未知值代替。 */
function createPermissionCheck(catalog: PermissionCatalog) {
  return async ({ user, request, route, status }: PermissionCheckContext) => {
    if (!user) return status(401, { message: "缺少凭据", code: "UNAUTHORIZED" });
    if (user.mustChangePassword) return status(403, { message: "请先修改密码", code: "PASSWORD_CHANGE_REQUIRED" });
    await catalog.ready();
    const required = catalog.permissionFor(request.method, route);
    if (required === false) return;
    if (!required) return status(403, { message: "没有对应的权限点，已拒绝", code: "FORBIDDEN" });
    const access = await accessRepository.forUser(user.id);
    if (!access.permissions.includes(required)) return status(403, { message: `缺少权限：${required}`, code: "FORBIDDEN" });
  };
}

export type PermissionCheck = ReturnType<typeof createPermissionCheck>;

/** 独立实例：路由目录与初始化状态不在多个 app 之间共享。 */
export function permissionGuard(options: PermissionCatalogOptions = {}) {
  const catalog = new PermissionCatalog(options);
  const permissionCheck = createPermissionCheck(catalog);
  catalog.setPermissionCheck(permissionCheck);
  return new Elysia({ name: "permission-guard" })
    .use(authGuard)
    .use(permissionCatalogPlugin(catalog))
    .onBeforeHandle({ as: "scoped" }, permissionCheck);
}
