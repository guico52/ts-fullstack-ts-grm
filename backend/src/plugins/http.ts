import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";

// 配置直接取自环境变量（Bun 会自动加载 backend/.env）。
const nodeEnv = process.env.NODE_ENV ?? "development";
const enableDocs =
  process.env.ENABLE_DOCS === undefined
    ? nodeEnv !== "production"
    : process.env.ENABLE_DOCS === "true";
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/** HTTP 配置和开发文档在登录守卫之前注册。 */
export function httpPlugin() {
  const plugin = new Elysia({ name: "http" }).use(cors({ origin: corsOrigins }));
  if (enableDocs) {
    plugin.use(
      swagger({
        path: "/docs",
        documentation: {
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
              },
            },
          },
          security: [{ bearerAuth: [] }],
          info: {
            title: "ts-fullstack-ts-grm API",
            version: "0.2.0",
            description: "Elysia + PostgreSQL + ts-grm 后端接口文档",
          },
          tags: [
            { name: "health", description: "健康检查" },
            { name: "auth", description: "登录" },
            { name: "rbac", description: "权限管理" },
            { name: "book", description: "图书管理" },
          ],
        },
      }),
    );
  }

  return plugin;
}
