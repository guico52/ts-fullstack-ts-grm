# 新增一个全栈业务资源

以 book/author 为最小示例，以 book/book 为关联示例。数据流是：数据库模型 → 仓储 → 服务 → 路由 → Treaty 客户端 → 类型明确的请求适配器 → 资源配置 → 页面。

## 后端

1. 在 backend/src/model/<领域>/index.ts 声明模型和 auditFields。新领域在 model/index.ts 的 EntityManager.of 注册。
2. 按 modules/book/author 的结构创建 model.ts（Elysia 校验模型）、repository.ts（ts-grm 查询 / pg 写入）、service.ts（业务规则）、index.ts（路由控制器工厂）。校验模型中的 createBody、updateBody 和响应类型一并声明。
3. 在领域聚合 index.ts 中调用模块工厂；新领域再挂到 app.ts 的认证和权限守卫之后。
4. 新接口自动生成 `METHOD:/路由模板` 权限；无需登记前缀或 seed。可能改路由的接口显式固定 code，需要豁免操作权限时声明 `permission: false`，详见[权限说明](./permissions.md)。
5. backend/ 内运行 bun run db:dev -n add_example，审查生成 SQL，提交迁移；在独立空库用 db:deploy 验证。

仓储层在事务内用 clientFor(session) 读回写入结果。PATCH 省略字段表示保留，null 只允许用于可清空字段，多对多数组整体替换。参数不得拼进 SQL 字符串。

## 前端

1. 扩展 lib/resource-types.ts 的 ResourceEntities 与 ResourceKey，在 lib/rbac.ts 或 lib/books.ts 添加 ResourceSpec，并登记 lib/resources.ts。定义列、字段、关联候选及 toForm。
2. lib/resource-api.ts 增加创建与更新适配器，返回后端校验模型推导类型，归一化具体控件值。不得用 as never / as any 绕过 Treaty。
3. 前端操作可见性使用与接口一致的权限 code（默认 `METHOD:/路由模板`，固定 code 则使用对应字符串）。新增 CRUD 资源需在 composables/useResourceActions.ts 配置其操作 code；有关联候选时扩展 lib/field-options.ts 的穷尽分支。
4. 参考 views/library/AuthorsView.vue：读取列表、删除、saveResource 保存，用 useResourceActions 得到能力，传入 ResourceListView 的 actions。展示组件不直接导入 store。
5. 组件自动由 views-catalog 发现。在视图管理创建 VIEW，选择组件并设置路由，再绑定到目标角色。菜单仅分组，按钮不注册为路由。不要在 router/nav 中再写一份静态业务表。

新角色只在缺失时初始化。新增页面和权限不会覆盖已有角色绑定；维护者应在角色管理中显式授权。默认初始化只负责全新项目；升级旧库若缺少管理入口，可用有权限的 API 创建视图并更新角色绑定，先导出原有绑定，避免整体替换时丢失授权。

## 验证

运行根 bun run check。数据库与权限变更再运行 [独立数据库测试](./testing.md)，为新的边界补充集成测试。
对关键用户流程使用真实后端全栈浏览器测试，模拟接口测试主要覆盖布局、交互和错误状态。
