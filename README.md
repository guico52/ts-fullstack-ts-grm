# ts-fullstack-ts-grm

TypeScript 全栈项目模板：Vue 3 管理端 + Elysia / PostgreSQL / ts-grm 后端。
用 **bun workspace** 组织单仓，前后端通过 **Eden Treaty** 共享类型——
后端改一处 schema，前端立刻编译报错。

```
frontend/   前端应用（Vue 3 + TypeScript + Vite + Tailwind v4 + Pinia）
backend/    后端服务（Bun + Elysia + PostgreSQL + ts-grm）
docs/       实际项目的文档
```

架构与 [`ts-fullstack-mongodb`](../ts-fullstack-mongodb) 同源，区别只在持久层：

- 数据库从 MongoDB 换成 **PostgreSQL**（统一 `pg` 驱动 + 连接池）。
- 查询走 **ts-grm**（`@ts-grm/core` + `@ts-grm/sql`）：模型即 schema，
  关联投影与分页由 DSL 推导。
- **写入用原生 pg 的参数化 SQL**，补足 ts-grm `save()` 的 insert / update 不足——
  `save()` 是整实体 upsert，无法表达「只改传入字段」的 PATCH 与精确的关联替换。
  分工与理由见 [`backend/docs/constraints.md`](./backend/docs/constraints.md#4-持久层分工)。
- 数据库**模型集中在 `backend/src/model/`**，由 `model/index.ts` 聚合、并导出 ts-grm 客户端。
  当前两个领域：`rbac`（组织 / 用户 / 视图 / 角色 / 权限）与 `book`（图书 / 作者 / 书店，
  刚好把多对一、一对多、多对多各演示一遍）。

## 文档在哪

三处 `docs/` 分工不同，不要混放：

- **`frontend/docs/`** —— 前端的文档与项目约束。设计系统、组件、表单、表格、
  导航规则，以及前端自己怎么开发、怎么检查。
- **`backend/docs/`** —— 后端的文档与项目约束。模块分层（model / repository /
  service / index）、依赖方向、持久层分工、错误响应约定、测试与迁移要求。
- **`docs/`** —— 实际项目的文档。跨前后端的整体内容：仓库结构、接口契约、
  数据模型、部署与运维。**这里放的是"这个项目"的事，不是"前端/后端这个模板"的事。**

简单判据：**只跟前端或后端有关，写进那一端的 `docs/`；同时牵涉两端、或只对这个
具体项目成立，写进根 `docs/`。**

各端 `README.md` 是该端入口，指向该端 `docs/`。

## 快速开始

需要 [Bun](https://bun.sh/) ≥ 1.2 与一个可连的 **PostgreSQL** 实例。
没有现成实例时，可以起一个临时库：

```bash
podman run -d --rm --name ts-grm-pg \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=ts_fullstack_ts_grm -p 5432:5432 postgres:17-alpine
```

然后：

```bash
bun install                                     # 在仓库根安装（workspace 统一锁定依赖）

cp backend/.env.example backend/.env            # 按需修改 PG_* 连接信息
bun run --filter @ts-fullstack-ts-grm/backend db:deploy   # 应用迁移，建表

bun run dev                 # 前后端一起启动，日志分别带 [backend] / [frontend] 前缀

#   后端 http://localhost:3000（接口文档 /docs）、前端 http://localhost:5173
#   也可单独启动：bun run dev:backend / bun run dev:frontend
```

后端连接池是**懒建立**的：进程启动时不会连库，首次访问数据库才连。数据库没起也能
启动服务、通过 `/health` 探活，由 `/health/db` 如实报告 `503`。

## 检查

```bash
bun run typecheck           # 两个包一起（跨包类型会被真的检查）
bun run test                # 后端单测 + 前端单测，都不依赖数据库
bun run build               # 构建前端
```

需要真实数据库的后端集成测试单独运行：

```bash
cd backend && PG_INTEGRATION=1 bun test tests/integration
```

前端另有一套浏览器测试（布局溢出、可访问性、导航），见
[`frontend/README.md`](./frontend/README.md)。

## 前后端怎么连

前端通过 Eden Treaty 直接消费后端的路由类型，没有 HTTP 客户端库，也没有第二份
接口定义。约定与踩坑记录见
[`frontend/docs/api-client.md`](./frontend/docs/api-client.md)。
