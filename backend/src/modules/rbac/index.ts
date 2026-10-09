import { Elysia } from "elysia";
import { organizationModule } from "./organization/index.ts";
import { permissionModule } from "./permission/index.ts";
import { roleModule } from "./role/index.ts";
import { userModule } from "./user/index.ts";
import { viewModule } from "./view/index.ts";

/**
 * 把 rbac 域的 controller 合成一个插件，交给 `app.ts` 挂载。
 *
 * 每个子模块都是**工厂**，这里必须**逐个调用**。少写一对括号不会报错，
 * 但会把整棵路由树挂错地方：Elysia 见到函数就当作 functional plugin，
 * 用当前实例去调它，而我们的工厂忽略入参、返回新实例 —— 于是返回的那个
 * 实例成了新的根，**其后**所有 `.use()` 都嵌进了它的 prefix
 * （实测：`/rbac/organizations/rbac/views/`）。见 docs/constraints.md。
 *
 * import 带显式 `.ts`：与 `model/` 目录保持同一条规则，见 docs/constraints.md。
 */
export function rbacModule() {
  return new Elysia({ name: "rbac" })
    .use(organizationModule())
    .use(permissionModule())
    .use(userModule())
    .use(viewModule())
    .use(roleModule());
}
