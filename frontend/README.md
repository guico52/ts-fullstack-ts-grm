# 前端应用

Vue 3 管理端：TypeScript、Vite、Tailwind v4、Pinia、Vue Router、shadcn-vue / Reka UI。
这是当前全栈仓库的前端子项目，使用真实后端、JWT 登录及 RBAC 动态路由。
上游来源见 [template-origin.md](./docs/template-origin.md)，初始化整个项目见 [模板使用](./docs/template-usage.md)。

## 开发与检查

在仓库根执行 `bun install --frozen-lockfile`，按[根 README](../README.md)配置、迁移并启动后端。
以下命令在 frontend/ 执行：

```bash
bun run dev
bunx playwright install chromium
bun run check
```

`check` 执行 typecheck、Prettier 检查、ESLint、单测、生产构建和浏览器测试。
单独执行 `bun run test` / `bun run build` / `bun run test:browser`。
默认 preview 端口 4173；已有服务占用时用 `PLAYWRIGHT_PORT=4175 bun run check`，测试不会复用旧服务。
真实全栈浏览器测试另用 `bun run test:e2e`，需要独立、已应用项目迁移的 PostgreSQL 测试库，见[测试说明](../docs/testing.md)。

## 代码入口

| 文件                                       | 用途                                     |
| ------------------------------------------ | ---------------------------------------- |
| src/lib/api.ts                             | 唯一 Treaty 客户端，自动携带 token       |
| src/lib/resource-api.ts                    | 类型明确的表单值转换为后端推导的请求类型 |
| src/lib/rbac.ts、src/lib/books.ts          | 资源字段、列表列与表单元数据             |
| src/components/data/ResourceListView.vue   | 共享列表、分页、编辑与删除               |
| src/components/rbac/ResourceFormDialog.vue | 共享表单及字段校验                       |
| src/stores/access.ts                       | 可访问视图和权限                         |
| src/router/index.ts、src/router/guard.ts   | 动态路由、刷新恢复与认证导航             |
| src/assets/main.css                        | 主题、字体、颜色及间距 token             |

数据来自 API，列表按服务端 limit / offset 分页；视图管理展示层级树。
导航来自 GET /auth/me/access，而不是静态路由表。操作能力经 props 传给展示组件，后端独立验证权限。
当前未提供国际化、独立会话撤销接口、服务端列表搜索或排序；关联候选最多加载 100 条，大规模数据应改成服务端搜索。

## 文档

[AGENTS.md](./AGENTS.md) 为开发入口；[文档索引](./docs/README.md)包含视觉规则、组件、表单、表格与检查流程。
[架构](./docs/architecture.md)、[导航](./docs/navigation.md)、[API 客户端](./docs/api-client.md)描述当前实现。
视觉细节保留在专题文档中。教程中的独立示意代码不代表已实现的业务页面。
