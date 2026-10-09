import { createApp } from "./app.ts";
import { close } from "./model";
import { ensureAdminUser } from "./modules/rbac/user/bootstrap.ts";
import { seedSystemData } from "./modules/rbac/seed.ts";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port);

console.log(`已启动：http://localhost:${port}（${process.env.NODE_ENV ?? "development"}）`);
if (process.env.ENABLE_DOCS !== "false" && process.env.NODE_ENV !== "production") {
  console.log(`接口文档：http://localhost:${port}/docs`);
}
console.log(
  `数据库：${process.env.PG_DATABASE ?? "ts_fullstack_ts_grm"} @ ${process.env.PG_HOST ?? "127.0.0.1"}:${process.env.PG_PORT ?? 5432}（pg 连接池懒建立）`,
);

/**
 * 初始化在**监听之后**跑，而且失败不阻止启动。
 *
 * 库没起时服务仍然可用、由 `/health/db` 如实报告 503 —— 这个性质不该因为
 * 初始化而丢掉。初始化是尽力而为的便利，不是启动的前置条件。
 *
 * 两步各自 try：其中一个失败不该把另一个拖下水，也不该让日志里只剩下一个
 * 含糊的“初始化失败”。
 */
try {
  await ensureAdminUser();
} catch (error) {
  console.warn("管理员初始化失败（服务照常运行）：", error instanceof Error ? error.message : error);
}

try {
  await seedSystemData();
} catch (error) {
  console.warn("原始数据初始化失败（服务照常运行）：", error instanceof Error ? error.message : error);
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，正在关闭…`);

  await app.stop();
  await close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
