import { Elysia } from "elysia";

import { accessRepository } from "./access.ts";
import { authGuard } from "./guard.ts";

/**
 * 路由前缀 → 权限点里的资源名。
 *
 * **加一个新资源要在这里登记一行。** 没登记的前缀一律拒绝（见下），所以漏写
 * 的表现是"新接口谁都调不通"，而不是"新接口谁都能调" —— 前者在开发时立刻
 * 被发现，后者要等到出事。
 */
const RESOURCE_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["/rbac/organizations", "rbac.organization"],
  ["/rbac/users", "rbac.user"],
  ["/rbac/views", "rbac.view"],
  ["/rbac/roles", "rbac.role"],
  ["/rbac/permissions", "rbac.permission"],
  ["/book/books", "book.book"],
  ["/book/authors", "book.author"],
  ["/book/stores", "book.store"],
];

/** HTTP 方法 → 动作。没有对应动作的方法（HEAD 之类）一律拒绝。 */
const ACTION_BY_METHOD: Record<string, string | undefined> = {
  GET: "read",
  POST: "create",
  PATCH: "update",
  DELETE: "delete",
};

/**
 * 这次请求需要哪个权限点；返回 null 表示"不该走到鉴权这一步"。
 *
 * 前缀按**最长匹配**取，所以将来有 `/book/books/:id/chapters` 这类更深的路径，
 * 只要它的前缀更长就能盖住父级。
 */
export function permissionFor(method: string, pathname: string): string | null {
  const action = ACTION_BY_METHOD[method];
  if (!action) return null;

  const hit = RESOURCE_BY_PREFIX.filter(([prefix]) => pathname.startsWith(prefix)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0];
  if (!hit) return null;

  return `${hit[1]}.${action}`;
}

/**
 * 按权限点校验，校验不过返回 403。
 *
 * 挂在 `app.ts` 里业务模块**之前**，于是它只覆盖其后加入的路由 —— `/health`
 * 和 `/auth/login` 在它之前注册，不受影响。
 *
 * **每次请求都查一次库。** 权限放进 token 会带来"改了权限但旧 token 还开着门"
 * 的问题，而 token 又被要求短小；对一个管理后台来说，多一次索引查询换正确性
 * 是划算的。真到了热路径，再在这里加缓存。
 */
export const permissionGuard = new Elysia({ name: "permission-guard" })
  .use(authGuard)
  .onBeforeHandle({ as: "scoped" }, async ({ user, request, status }) => {
    // authGuard 已经拒绝了没有凭据的请求；这里只是收窄类型。
    if (!user) return status(401, { message: "缺少凭据", code: "UNAUTHORIZED" });

    const pathname = new URL(request.url).pathname;
    const required = permissionFor(request.method, pathname);

    // 不属于任何已登记资源的路由：放在这里是为了让"没登记"变成拒绝，
    // 而不是悄悄放行。
    if (!required) {
      return status(403, { message: "没有对应的权限点，已拒绝", code: "FORBIDDEN" });
    }

    const access = await accessRepository.forUser(user.id);
    if (!access.permissions.includes(required)) {
      return status(403, { message: `缺少权限：${required}`, code: "FORBIDDEN" });
    }
  });
