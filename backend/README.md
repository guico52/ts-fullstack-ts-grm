# backend

`ts-fullstack-ts-grm` 的后端：**Elysia + PostgreSQL + ts-grm**。

开发前先读 [`docs/constraints.md`](./docs/constraints.md)——模块分层、模型组织方式、
持久层分工、错误约定与已知限制都在那里。

## 技术选型

- **运行时**：Bun，直接跑 TypeScript，无构建步骤
- **Web 框架**：[Elysia](https://elysiajs.com/) 1.x；校验用内置 `Elysia.t`
- **数据库**：PostgreSQL，`pg` 驱动 + 连接池（未使用查询构建器）
- **查询层**：[ts-grm](https://github.com/babyfish-ct/ts-grm)（`@ts-grm/core` + `@ts-grm/sql`）
- **补丁**：[`ts-grm-patches`](https://www.npmjs.com/package/ts-grm-patches)——列级
  `autoIncrement`/`default` 与全局过滤器
- **迁移**：[`ts-grm-migrate`](https://www.npmjs.com/package/ts-grm-migrate)（`tgm` 命令）
- **接口文档**：`@elysiajs/swagger`，非生产环境挂 `/docs`

## 命令

仓库根执行：

```bash
bun run dev                                             # 前后端一起（日志带来源前缀）
bun run dev:backend                                     # 只跑后端：热重载
bun run --filter @ts-fullstack-ts-grm/backend test      # 单元测试（不依赖数据库）
bun run --filter @ts-fullstack-ts-grm/backend typecheck
```

`backend/` 内可直接 `bun run dev` / `bun test` / `bun run typecheck`。

数据库迁移（`backend/` 内）：

```bash
bun run db:dev -n init   # 生成并应用一个迁移
bun run db:deploy        # 应用待应用迁移
bun run db:status        # 查看迁移状态
bun run db:check         # 模型与库是否一致
bun run db:push          # 直接同步库结构（不写历史，仅本地）
```

需要真实数据库的集成测试：

```bash
PG_INTEGRATION=1 bun test tests/integration
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改：

- `NODE_ENV`：`development` | `test` | `production`
- `PORT`：HTTP 端口，默认 `3000`
- `PG_HOST` / `PG_PORT` / `PG_DATABASE` / `PG_USER` / `PG_PASSWORD`：PostgreSQL 连接
- `CORS_ORIGINS`：允许的前端来源，逗号分隔
- `ENABLE_DOCS`：接口文档开关；不设置时非 production 默认开启

## 目录

```
src/
  index.ts                 进程入口：监听、优雅关闭
  app.ts                   组装应用：CORS、错误处理、挂载模块、Swagger
  errors.ts                领域错误 + SQLSTATE 分类
  model/                   模型与数据库入口
    index.ts                 EntityManager.of、全局过滤器、连接池、client、事务
    embedded.ts              auditFields 等公共嵌入字段
    rbac/index.ts            RBAC 模型
    book/index.ts            图书域模型（三种关联各有示例）
  modules/                   每个领域一个目录，域内每个实体一个子目录
    <领域>/index.ts          域聚合：把该域的 controller 合成一个插件
    rbac/organization/       组织
    rbac/user/               用户（所属组织 + 口令哈希）
    rbac/view/               视图（自引用父子 + 枚举 type）
    rbac/role/               角色（用户 / 视图 / 权限三组关联）
    rbac/permission/         权限
    book/book/               图书（所属书店 + 多对多作者）
    book/author/             作者
    book/store/              书店
migrations/                迁移 SQL（纳入版本控制）
ts-grm-migrate.config.ts   迁移配置（独立入口，自行加载 .env）
tests/                     单测；tests/integration/ 需真实库
```

## 接口

- `GET /health` —— 服务存活
- `GET /health/db` —— 业务表可读性探针（不可用时 503）
- `POST /auth/login` —— 邮箱 + 口令换用户信息（`{ id, name, email }`）。
  **没有 token，也不拦其他接口**；未命中与口令不对回同样的 401。
- `/rbac/organizations`、`/rbac/users`、`/rbac/views`、`/rbac/roles`、`/rbac/permissions`
- `/book/books`、`/book/authors`、`/book/stores`

每个资源都有 `GET /`（分页列表）、`GET /:id`、`POST /`、`PATCH /:id`、`DELETE /:id`（软删除）——
共 8 个资源，路由由 `modules/<领域>/index.ts` 聚合后交给 `app.ts` 挂载。

- `GET /docs` —— Swagger UI（非生产环境）

各资源的差异：

- **users**：`organizationId` 引用组织，响应里嵌套 `organization: { id, name }`；
  `password` 只存哈希（`Bun.password`），从不回显。组织被软删除后 `organization` 为 `null`。
- **views**：`parentId` 自引用，列表支持 `?parentId=` 过滤，`PATCH` 传 `parentId: null` 回到根。
  层级是严格的三层，由 service 强制（违反返回 `422 INVALID_HIERARCHY`）：

  | 类型 | 上级                             |
  | ---- | -------------------------------- |
  | 菜单 | 不允许（必须是顶层）             |
  | 页面 | 可挂在菜单下，也可独立成顶层页面 |
  | 按钮 | 必须挂在页面下                   |

  `componentName`（组件名）与 `path`（路由）由前端按 `componentPath` 推导：组件名取文件名的
  大驼峰形式，路由取其小写加 `-` 的形式。
  `path` / `componentPath` / `componentName` **可空**：菜单是分组节点、按钮是最小授权点，
  两者都不由路由到达，不需要组件信息。
  `sort` 在同级内**自动递增**：不传时取同级的 `MAX(sort) + 1`（第一个为 1），在插入的同一个
  事务里计算；显式传值则以传入为准。层级按 `parent_id` 区分，顶层与各级各算各的。

- **roles**：`userIds` / `viewIds` / `permissionIds` 三组关联，传了就**整体替换**、
  省略则保留原值。
- **books**：`storeId` 指向书店（列 NOT NULL，所以必填），`authorIds` 与作者是多对多
  （中间表 `book_author_mapping`），同样传了就整体替换。
  `store` 在书店被软删除后是 `null`，`authors` 会相应地少几个。
  `price` 是 `numeric(10, 2)`，出参是**数字**（88.50 → `88.5`），前端负责补回两位小数。
- **authors / stores**：只暴露自身字段。它们是**被指向**的一方，写入发生在图书那一侧；
  软删除它们不会动图书的 `store_id` 与中间表，只是那些引用再也读不出来。

## 关键设计

**模型与数据库只有一个入口。** 模型在 `src/model/` 声明，`src/model/index.ts` 用
`EntityManager.of` 注册（**新领域要在这里显式列出**）、注册全局过滤器，并在同一处创建
连接池与 ts-grm `client`；repository 直接 import 它，业务层不再传递数据库句柄。

**模块是工厂，域里再聚合一层。** 每个实体导出 `xxxModule()` 返回一个 `Elysia` 实例，
`modules/<领域>/index.ts` 把它们合成一个域插件，`app.ts` 只挂域。
**工厂必须调用** —— `.use(工厂)` 被 Elysia 当成 functional plugin，会把后续模块嵌进
错误的前缀（见约束文档第 9 节）。

**配置没有中间层。** 应用直接读 `process.env`（Bun 自动加载 `backend/.env`）；
迁移配置是独立入口，在文件内自行加载一次 `.env`（Node 不自动读）。

**读用 ts-grm，写用原生 pg。** ts-grm 的 `save()` 是整实体 upsert，表达不了局部更新与
精确的关联替换，所以读写分工：查询走 DSL，insert/update/delete 走参数化 SQL。
理由见约束文档第 4 节。

**连接池懒建立。** 进程启动不连库，首次查询才连；数据库没起也能启动并通过 `/health` 探活。

**软删除是全局过滤器。** `model/index.ts` 用 `createGlobalFilterManager(entityManager)` 注册一次，
所有查询自动排除 `deleted_at` 非空的行，repository 里不必重复写条件。**关联查询同样被过滤**，
所以指向已删除行的对象投影会是 `null`（见约束文档第 9 节）。

**事务内可读到未提交的写。** `transaction((session) => ...)` 里用 `clientFor(session)`
取得的 ts-grm 客户端复用同一 pg 会话，`INSERT` 之后能立刻读回完整视图。
