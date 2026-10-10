# 验证与测试数据库

需要 Bun 1.3.14、Node.js ≥24.11.0，浏览器检查另需 Chromium。

```bash
bun install --frozen-lockfile
cd frontend
bunx playwright install chromium
cd ..
bun run check
```

根 check 覆盖两端 typecheck / 单测，以及前端 Prettier、ESLint、构建和 mock API 浏览器测试。
mock 浏览器测试使用测试会话和可达集合，不依赖数据库。gotoPage 验证页面标题，避免在登录或 404 页面上误通过。
默认 preview 端口 4173，占用时用 PLAYWRIGHT_PORT=4175 bun run check。

## 真实数据库与全栈流程

必须使用独立测试库，不能指向生产数据库。集成和 E2E 测试会初始化系统数据、写入和清理测试记录；清理失败可能留下数据。

```bash
# 在仓库根、同一个 shell 中执行。仅绑定本机，临时容器退出后删除。
podman run -d --rm --name template-test-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=test-password \
  -e POSTGRES_DB=template_test -p 127.0.0.1:55439:5432 postgres:17-alpine
# 等待 podman exec template-test-pg pg_isready -U postgres 成功，再继续。
export PG_HOST=127.0.0.1 PG_PORT=55439 PG_DATABASE=template_test PG_USER=postgres
export PG_PASSWORD=test-password ADMIN_EMAIL=admin@example.com ADMIN_PWD=test-admin-password
export NODE_ENV=test JWT_SECRET=test-only-secret-not-for-production
bun run db:deploy
bun run test:integration
bun run test:e2e
podman stop template-test-pg
```

集成测试自动创建管理员和 seed，不依赖此前启动过服务；测试请求直接走 app.handle。
E2E 自行启动真实后端和前端，验证管理员登录、系统页面可达、换账号、观察者无写操作入口及服务端 403。
端口默认后端 3015、前端 4185，可用 E2E_BACKEND_PORT / E2E_FRONTEND_PORT 覆盖。
E2E 按自己的 VITE_API_URL 重新构建 dist；之后开发或发布应重新按目标配置构建。

mock trace 在失败时保留于 frontend/test-results/；真实全栈 trace 独立保留于 frontend/smoke-artifacts/fullstack/，防止两套测试互相清理产物。

E2E 使用独立的 smoke-artifacts/fullstack-dist 构建目录，避免覆盖日常 build 和 mock 浏览器测试使用的 dist。密码流程详见[密码管理](./passwords.md)。
