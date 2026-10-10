/**
 * 路由前缀 → 权限点里的资源名。
 *
 * 此配置固定现有示例的业务 code。新接口无需登记，未匹配时使用 method + 路由模板。
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

/** 示例已有 HTTP 方法 → 固定动作，其余方法使用自动生成。 */
const ACTION_BY_METHOD: Record<string, string | undefined> = {
  GET: "read",
  POST: "create",
  PATCH: "update",
  DELETE: "delete",
};

/** 示例已有接口使用固定 code；新增接口回退到自动生成。仅匹配路由模板。 */
export function permissionFor(method: string, path: string): string | null {
  const pathname = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (method === "POST" && pathname === "/rbac/users/:id/password") return "rbac.user.resetPassword";
  const action = ACTION_BY_METHOD[method];
  if (!action) return null;
  const hit = RESOURCE_BY_PREFIX.find(([prefix]) => pathname === prefix || pathname === `${prefix}/:id`);
  if (!hit) return null;
  const detail = pathname.endsWith("/:id");
  if (method === "GET" || (method === "POST" && !detail) || ((method === "PATCH" || method === "DELETE") && detail)) return `${hit[1]}.${action}`;
  return null;
}
