# 贡献指南

先阅读根 README 和相关端的约束文档。Bug 报告包含操作步骤、预期与实际行为、Bun / Node / PostgreSQL 版本；不要附带密钥或数据库凭据。

## 开发

在根目录 bun install --frozen-lockfile，复制 backend/.env.example，使用独立开发库执行 bun run db:deploy，再 bun run dev。
前端变更遵守 frontend/AGENTS.md 和 frontend/docs/constraints.md；后端遵守 backend/docs/constraints.md。
不丢弃他人的未提交修改，不执行 git reset --hard、git clean -f、git restore 或 git stash。

## 提交前

- bun run check：两端类型、单测、前端 lint、构建和 mock 浏览器测试。
- 修改数据库或鉴权时，在独立测试库运行 bun run test:integration 与 bun run test:e2e，见 [测试指南](./docs/testing.md)。
- 新模型提交迁移 SQL；新增资源同步权限映射、typed adapter、视图和文档。
- PR 说明触发条件、最终行为与验证结果；不要提交 .env、构建产物或本地状态。

贡献按本仓库 Apache-2.0 许可证提供。引用外部实现需用 @see 标明来源，并保留其许可及归属要求。
