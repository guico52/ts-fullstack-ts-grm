import { createApp } from "./app.ts";
import { close } from "./model";
import { seedSystemData } from "./modules/rbac/seed.ts";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

// 完整目录同步成功后再初始化角色并监听，避免提供尚未准备好的授权入口。
// 插件 onStart 使用同一初始化 Promise，不重复写库。
try {
  await app.decorator.permissionCatalog.start(app.routes);
  await seedSystemData();
} catch (error) {
  await close();
  throw error;
}

app.listen(port);
console.log(`已启动：http://localhost:${port}（${process.env.NODE_ENV ?? "development"}）`);
if (process.env.ENABLE_DOCS !== "false" && process.env.NODE_ENV !== "production") {
  console.log(`接口文档：http://localhost:${port}/docs`);
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
