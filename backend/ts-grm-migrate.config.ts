import { fileURLToPath } from "node:url";
import { defineConfig } from "ts-grm-migrate";

// 迁移 CLI 跑在 Node 下，不会自动读 .env；这里显式加载一次（Bun 侧由 Bun 自动加载）。
try {
  process.loadEnvFile?.(fileURLToPath(new URL("./.env", import.meta.url)));
} catch {
  // 没有 .env 时走下面的默认值。
}

export default defineConfig({
  dialect: "postgres",
  database: {
    host: process.env.PG_HOST ?? "127.0.0.1",
    port: Number(process.env.PG_PORT ?? 5432),
    database: process.env.PG_DATABASE ?? "ts_fullstack_ts_grm",
    user: process.env.PG_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? "",
  },
  models: ["./src/model"],
  migrationsDir: "./migrations",
  schema: "public",
  language: "zh-CN",
});
