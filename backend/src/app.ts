import { Elysia, t } from "elysia";
import { httpPlugin } from "./plugins/http.ts";
import { errorPlugin } from "./plugins/errors.ts";
import { ready } from "./model";
import { authGuard } from "./plugins/auth.ts";
import { authModule } from "./modules/auth";
import { permissionFor } from "./plugins/permission-codes.ts";
import { permissionGuard } from "./plugins/permission.ts";
import { bookModule } from "./modules/book";
import { rbacModule } from "./modules/rbac";

/**
 * 组装应用：全局插件 + 全局错误处理 + 挂载各业务模块。
 * 与 `index.ts` 分开，是为了让测试直接 `app.handle(request)`，不必监听端口。
 */
export function createApp() {
  // `onError` 必须注册在 `.use(模块)` **之前**：Elysia 的生命周期钩子只对之后
  // 加入的路由生效，写在后面时插件路由里的异常会漏成框架默认响应。
  const app = new Elysia({ name: "ts-fullstack-ts-grm-backend" })
    .use(httpPlugin())
    .use(errorPlugin())
    .get("/health", () => ({ status: "ok", uptime: process.uptime() }), {
      response: { 200: t.Object({ status: t.String(), uptime: t.Number() }) },
      detail: { summary: "服务存活探针", tags: ["health"], security: [] },
    })
    .get(
      "/health/db",
      async ({ status }) => {
        // 探针查真实业务表：权限不足或未迁移都会如实报 503。
        if (await ready()) return { status: "ok", database: "postgresql" };
        return status(503, { status: "unavailable", database: "postgresql" });
      },
      {
        response: {
          200: t.Object({ status: t.String(), database: t.String() }),
          503: t.Object({ status: t.String(), database: t.String() }),
        },
        detail: { summary: "业务表可读性探针", tags: ["health"], security: [] },
      },
    );

  // Swagger 注册在守卫之前，开发文档可匿名打开；业务路由仍受两个守卫保护。
  return app
    .use(authModule())
    .use(authGuard)
    .use(permissionGuard({ generateCode: permissionFor }))
    .use(rbacModule())
    .use(bookModule());
}

/**
 * 应用的完整类型，供前端 Eden Treaty 消费（见 `frontend/src/lib/api.ts`）。
 * 这里只导出类型：启动逻辑在 `index.ts`，导入本文件不会监听端口。
 */
export type App = ReturnType<typeof createApp>;
