import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia, t } from "elysia";
import {
  DatabaseAuthError,
  DatabaseConflictError,
  DatabaseReferenceError,
  DatabaseUnavailableError,
  InvalidHierarchyError,
  ResourceNotFoundError,
} from "./errors.ts";
import { organizationModule } from "./modules/rbac/organization/index.ts";
import { permissionModule } from "./modules/rbac/permission/index.ts";
import { roleModule } from "./modules/rbac/role/index.ts";
import { userModule } from "./modules/rbac/user/index.ts";
import { viewModule } from "./modules/rbac/view/index.ts";
import { ready } from "./model/index.ts";

// 配置直接取自环境变量（Bun 会自动加载 backend/.env）。
const nodeEnv = process.env.NODE_ENV ?? "development";
const enableDocs = process.env.ENABLE_DOCS === undefined
  ? nodeEnv !== "production"
  : process.env.ENABLE_DOCS === "true";
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** onError 的 `error` 可能是 Error，也可能是 Elysia 的自定义状态响应；安全取文本。 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 组装应用：全局插件 + 全局错误处理 + 挂载各业务模块。
 * 与 `index.ts` 分开，是为了让测试直接 `app.handle(request)`，不必监听端口。
 */
export function createApp() {
  // `onError` 必须注册在 `.use(模块)` **之前**：Elysia 的生命周期钩子只对之后
  // 加入的路由生效，写在后面时插件路由里的异常会漏成框架默认响应。
  const app = new Elysia({ name: "ts-fullstack-ts-grm-backend" })
    .use(cors({ origin: corsOrigins }))
    .onError(({ code, error, set }) => {
      if (code === "VALIDATION") {
        set.status = 422;
        return { message: "请求参数不合法", code };
      }
      if (code === "NOT_FOUND" || error instanceof ResourceNotFoundError) {
        set.status = 404;
        return { message: error instanceof Error ? error.message : "接口不存在", code: "NOT_FOUND" };
      }
      // A malformed tree is the caller's mistake, not a server fault.
      if (error instanceof InvalidHierarchyError) {
        set.status = 422;
        return { message: error.message, code: "INVALID_HIERARCHY" };
      }
      // 凭据被拒是配置错误，重试不会成功，必须和"暂时连不上"区分开。
      if (error instanceof DatabaseAuthError) {
        set.status = 500;
        console.error("PostgreSQL 认证失败：", describeError(error));
        return { message: "数据库凭据无效", code: "DATABASE_AUTH_FAILED" };
      }
      if (error instanceof DatabaseUnavailableError) {
        set.status = 503;
        console.error("PostgreSQL 连接失败：", describeError(error));
        return { message: "数据库暂时不可用", code: "DATABASE_UNAVAILABLE" };
      }
      if (error instanceof DatabaseConflictError) {
        set.status = 409;
        return { message: error.message, code: "CONFLICT" };
      }
      if (error instanceof DatabaseReferenceError) {
        set.status = 422;
        return { message: error.message, code: "INVALID_REFERENCE" };
      }

      set.status = 500;
      console.error("未处理的错误：", error);
      return { message: "服务器内部错误", code };
    })
    .get("/health", () => ({ status: "ok", uptime: process.uptime() }), {
      response: { 200: t.Object({ status: t.String(), uptime: t.Number() }) },
      detail: { summary: "服务存活探针", tags: ["health"] },
    })
    .get("/health/db", async ({ status }) => {
      // 探针查真实业务表：权限不足或未迁移都会如实报 503。
      if (await ready()) return { status: "ok", database: "postgresql" };
      return status(503, { status: "unavailable", database: "postgresql" });
    }, {
      response: {
        200: t.Object({ status: t.String(), database: t.String() }),
        503: t.Object({ status: t.String(), database: t.String() }),
      },
      detail: { summary: "业务表可读性探针", tags: ["health"] },
    })
    .use(organizationModule())
    .use(userModule())
    .use(viewModule())
    .use(roleModule())
    .use(permissionModule());

  if (enableDocs) {
    app.use(
      swagger({
        path: "/docs",
        documentation: {
          info: {
            title: "ts-fullstack-ts-grm API",
            version: "0.1.0",
            description: "Elysia + PostgreSQL + ts-grm 后端接口文档",
          },
          tags: [
            { name: "health", description: "健康检查" },
            { name: "rbac", description: "权限管理" },
          ],
        },
      }),
    );
  }

  return app;
}

/**
 * 应用的完整类型，供前端 Eden Treaty 消费（见 `frontend/src/lib/api.ts`）。
 * 这里只导出类型：启动逻辑在 `index.ts`，导入本文件不会监听端口。
 */
export type App = ReturnType<typeof createApp>;
