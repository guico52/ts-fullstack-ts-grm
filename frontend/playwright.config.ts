import { defineConfig } from "@playwright/test"

/**
 * Browser tests for things that only exist once a layout engine is running:
 * overflow, truncation, and anything measured in pixels.
 *
 * A component test with happy-dom cannot see any of this — it has no
 * layout. happy-dom will happily report an element as 0x0 and call it a
 * pass.
 */
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  // Preview only serves static files; each test has its own browser context,
  // including storage and in-memory stores. Keep concurrency modest on CI.
  // @see https://playwright.dev/docs/browser-contexts
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    // 只负责启动服务，不负责构建。
    //
    // 曾经这里是 `bun run build && bun run preview`，而 `reuseExistingServer:
    // false` 意味着**每一次**调用 playwright 都要完整构建一遍——包括
    // 只想跑单个用例的调试。构建是整轮一次的事，不是每个进程一次的事。
    // 现在由 `bun run test:browser` 构建，webServer 只等服务就绪。
    //
    // 直接调 `bunx playwright test` 需要 dist 已经存在；用
    // `bun run test:browser` 则不必关心。
    command: "bun run preview",
    url: "http://127.0.0.1:4173",
    // 始终不用已存在的服务：从早先会话遗留的 preview 会拿旧构建去喂测试，
    // 每个用例都通过，但验的不是磁盘上的代码。
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
