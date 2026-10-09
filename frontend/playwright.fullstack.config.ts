import { fileURLToPath } from "node:url"
import { defineConfig } from "@playwright/test"

const backendPort = process.env.E2E_BACKEND_PORT ?? "3015"
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "4185"
const apiURL = `http://127.0.0.1:${backendPort}`
const baseURL = `http://127.0.0.1:${frontendPort}`

/** 必须指向独立已迁移的测试库；两个服务都由测试管理，禁止复用其他进程。 */
export default defineConfig({
  testDir: "./tests/fullstack",
  workers: 1,
  timeout: 30_000,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: [
    {
      command: "bun run start",
      cwd: fileURLToPath(new URL("../backend", import.meta.url)),
      url: `${apiURL}/health/db`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "test",
        PORT: backendPort,
        CORS_ORIGINS: baseURL,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@example.com",
        ADMIN_PWD: process.env.ADMIN_PWD ?? "test-admin-password",
        JWT_SECRET: process.env.JWT_SECRET ?? "e2e-only-secret-not-for-production",
      },
    },
    {
      command: `bun run build && bun run preview --port ${frontendPort} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      env: { VITE_API_URL: apiURL },
      timeout: 120_000,
    },
  ],
})
