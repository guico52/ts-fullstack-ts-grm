/**
 * 并行启动前端与后端的开发服务。
 *
 * 两个子进程的 stdout/stderr 逐行加上 `[backend]` / `[frontend]` 前缀，
 * 方便在同一个终端里分辨来源。任一子进程退出（或收到 Ctrl+C）时一起退出。
 *
 * 用法：bun run dev
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");

const targets = [
  { name: "backend", cwd: join(root, "backend") },
  { name: "frontend", cwd: join(root, "frontend") },
] as const;

/** 逐行读取子进程输出，加前缀后写到本进程的标准输出。 */
async function pump(stream: ReadableStream<Uint8Array>, prefix: string): Promise<void> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let rest = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      rest += decoder.decode(value, { stream: true });
      const lines = rest.split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) process.stdout.write(`${prefix}${line}\n`);
    }
  } catch {
    // 子进程被终止时读取会中断，忽略即可。
  }
  if (rest) process.stdout.write(`${prefix}${rest}\n`);
}

const children = targets.map((target) => {
  const child = Bun.spawn(["bun", "run", "--silent", "dev"], {
    cwd: target.cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    // 输出走管道时子进程会认为不是 TTY，显式要求保留颜色。
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  void pump(child.stdout, `[${target.name}] `);
  void pump(child.stderr, `[${target.name}] `);
  return child;
});

let shuttingDown = false;
function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const codes = await Promise.all(children.map((child) => child.exited));
// 主动退出（Ctrl+C）按成功处理；否则跟随第一个非零退出码。
process.exit(shuttingDown ? 0 : (codes.find((code) => code !== 0) ?? 0));
