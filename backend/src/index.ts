import { createApp } from "./app.ts";
import { close } from "./model";

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
