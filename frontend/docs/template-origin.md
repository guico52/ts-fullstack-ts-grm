# 模板来源

本前端项目由 `vue-admin-template` 的已提交版本导出，未携带模板的 Git 历史。

- 来源仓库（本地）：`/home/guico/code/template/vue-admin-template`
- 上游地址：`https://gitea.guico.top/guico/vue-admin-template.git`
- 引用：`HEAD`（导出时该仓库没有版本标签）
- 提交标识：`975ae3cfc3808b7d7ea08a41a39fcf0aacd512b2`
- 导出方式：`git archive HEAD`，只导出已提交内容，不含 `.git`、`node_modules`、`dist` 等本地状态
- 导出日期：2026-10-09

## 已完成的定制

- `package.json` 的 `name` 改为 `@ts-fullstack-ts-grm/frontend`，成为仓库根 Bun 工作区的成员包
- 原本独立的 `bun.lock` 已移除，依赖由仓库根的 `bun.lock` 统一锁定
- `README.md` 顶部补充本目录在 `ts-fullstack-ts-grm` 全栈模板中的角色说明

## 业务使用时需要定制

以下步骤见 [`template-usage.md`](./template-usage.md)，按业务需要推进：

- `src/config/brand.ts` 的公司全称、项目名、默认图片 URL 与字体
- 标志图片替换（彩色标志需检查 `dark:invert`）
- `tests/browser/navigation.spec.ts` 中与品牌文字、页面标题、默认图片相关的断言
- 业务页面与角色绑定的视图、权限；路由和导航已经由服务端动态配置

## 后续同步

独立导出的项目不会自动跟随模板更新。模板有新版本时，
`git fetch` 上游后对比差异，选择明确的提交迁移，并在本文件追加迁移记录。

## 全栈适配

已接入真实接口、JWT、角色权限、动态路由、RBAC 与图书管理页面。Apache-2.0 授权已由仓库所有者确认，保留根 LICENSE / NOTICE。
