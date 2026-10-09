# 后端约束

新增模块、改模型或调整依赖前先读本文件。

## 1. 技术栈

- 运行时 **Bun**，直接跑 TypeScript，无构建步骤。
- Web 框架 **Elysia 1.x**；校验用内置 `Elysia.t`（TypeBox），不引入 zod/yup。
- 数据库 **PostgreSQL**，`pg` 驱动 + 连接池，不引入查询构建器。
- 查询层 **ts-grm**：`@ts-grm/core` 与 `@ts-grm/sql` **必须同版本**（当前 `0.0.13`）。
- 补丁包 **`ts-grm-patches`**：列级 `autoIncrement` / `default` 与 `GlobalFilterManager`。
- 迁移工具 **`ts-grm-migrate`**（alpha），命令是 `tgm`。
- 项目必须是 **ESM**（`"type": "module"`）。

## 2. 目录与分层

```
src/
├── model/                     模型 + 数据库入口
│   ├── index.ts               EntityManager.of、全局过滤器、连接池、client、事务
│   ├── embedded.ts            公共嵌入字段（auditFields）
│   ├── rbac/index.ts          按领域分的模型文件
│   └── book/index.ts          一个领域一个文件
├── modules/<领域>/            业务模块，一个领域一个目录
│   ├── index.ts               域聚合：把该域的 controller 合成一个插件
│   └── <实体>/
│       ├── model.ts           校验 schema
│       ├── repository.ts      读 ts-grm / 写原生 pg
│       ├── service.ts         业务规则
│       └── index.ts           Elysia controller
├── errors.ts                  领域错误 + SQLSTATE 分类
├── app.ts                     组装：插件 + 错误处理 + 挂模块
└── index.ts                   进程入口
```

当前三个领域：`rbac`（org / user / view / role / permission）、`book`
（book / author / store）与 `auth`。

**域里只有一个实体时不再套一层。** `modules/auth/` 直接把
`model / repository / service / index` 四个文件放在域目录下 —— 域聚合层是为
“一个域有多个 controller”准备的，为一个 endpoint 造三层目录只是形式。

依赖方向单向前进，不允许反向或跨层：

```
index → service → repository → model/index（client、事务）
  ↘        ↓           ↓
       model.ts（schema 与类型）
```

- ❌ `service` / `index` 里出现 SQL、`import "pg"`、`import "@ts-grm/..."` 或 `Context`
- ❌ `index` 绕过 service 直接访问数据库
- ❌ `repository` 做业务判断或抛 HTTP 错误
- ❌ 另起一处 `new Pool()` 或 `newSqlClient()`——连接与客户端只此一份

## 3. 模型与数据库入口（`src/model/`）

- 模型是 schema 的**唯一来源**：查询投影与迁移 DDL 都由它推导，没有第二份 schema 文件。
- 一个领域一个文件（如 `rbac/index.ts`），公共字段用嵌入组合（`audit = auditFields`）。
- 每个定义模型的文件在顶部调用一次 `applyPatches()`——必须在 `model()`/`prop` **之前**。
- **字符串列用 `prop.str(n)` 还是 `prop.text()`，只看一件事：这一列会不会被用来找某一行。**

  | 这一列… | 用 |
  | --- | --- |
  | 会出现在 WHERE / ORDER BY（名字、编码、路由、权限名…） | `prop.str(n)` |
  | 只被读出来、在**应用层**处理（`pwd_hash` 交给 `Bun.password.verify`，`logo` 是个 URL） | `prop.text()` |

  保持 `text()` 的列要在模型里**逐列注明理由**——否则下一个人分不清那是设计还是漏改。
  `n` 以对应 Elysia schema 的 `maxLength` 为准，让“能存多长”只有一处说法；
  它在 PostgreSQL 方言下不进 DDL，所以改这一条不产生迁移（第 9 节有完整解释）。

### `model/index.ts`

```ts
// 新领域要在这里显式列出。迁移工具按目录递归扫描 src/model/，但运行时
// 只认这几条路径 —— 漏掉一个文件，表能建出来，查询却报「模型未注册」。
export const entityManager = EntityManager.of(
  import.meta.dirname,
  "./rbac/index.ts",
  "./book/index.ts",
);
export const pool = new Pool({/* process.env.PG_* */});

// 全局过滤器（软删除）：传 entityManager，模型清单由它汇总；构造客户端之前必须注册完
const filters = await createGlobalFilterManager(entityManager);
filters.addGlobalFor<DateExpression<Date | null>>("deletedAt", (column) =>
  column.isNull(),
);

export const client = newSqlClient(new PostgresDriver(pool), {
  entityManager,
  filterManager: filters,
});
export function clientFor(session: PoolClient): SqlClient; // 事务内钉住会话
export async function transaction<T>(fn); // BEGIN/COMMIT/ROLLBACK
export async function run<T>(fn); // 错误分类包装
export async function ready(): Promise<boolean>; // 业务表探针
```

- 模型注册用 `EntityManager.of`：baseDir 必须是**目录**，模型路径必须是 `./` 开头的相对路径。
  **`of` 是变长参数**，一个领域一条路径；迁移配置里的 `models: ["./src/model"]` 是目录扫描，
  与这里不是一回事，两边都要照顾到。
- repository 直接 `import { client, clientFor, run, transaction } from "../../../model/index.ts"`，
  不再往业务层传数据库句柄。

> `src/model/` 下的文件会被**迁移工具**用 Node 原生 import 加载（含 `index.ts`）。
> 因此**该目录内**的相对导入、以及它们引用到的文件（如 `../errors.ts`）一律写显式 `.ts`。
>
> **边界就在 `src/model/`。** 其他地方的相对导入**不带**扩展名：
> `modules/**/repository.ts` 里写 `from "../../../model"`（目录名，解析到 `index.ts`），
> `app.ts` 里写 `from "./modules/rbac"`——它们跑在 **Bun** 下，不经过 Node 的解析器。
> 照抄 `repository.ts` 的写法去改 `model/` 里的导入，`tgm` 会直接报模块找不到。

### 全局过滤器

```ts
// model/index.ts
const filters = await createGlobalFilterManager(entityManager); // ts-grm-patches ≥0.2.1
filters.addGlobalFor<DateExpression<Date | null>>("deletedAt", (column) =>
  column.isNull(),
);
```

- 传 `entityManager` 即可，**不必手写模型清单**（由它的 `entities()` 汇总）；也接受模型数组。
- 该函数是**异步的**，用顶层 await 在 `newSqlClient()` 之前完成注册。
- 按**列名**注册：不含该列的模型不受影响，关联查询直接读外键的优化也保留。
- 过滤器在 `newSqlClient()` 时被快照，必须在构造客户端之前注册完。
- 因此 repository 里**不要**再写 `deleted_at is null`；删除就是软删除。

## 4. 持久层分工

### 读：ts-grm

```ts
const query = client.createQuery(SysOrganization, (q, organization) => {
  q.orderBy(organization.id.asc());
  return q.select(organization.fetch(OrganizationView));
});
const [data, total] = await Promise.all([
  query.fetchRange({ limit, offset }),
  query.fetchCount(),
]);
```

- 投影用 `dto.view(Model, (c) => [...])` 声明，返回类型由它推导，**不要手工拼装行对象**。

### 写：原生 pg 参数化 SQL

**不用 ts-grm 的 `save()`**：它是整实体 upsert——

- 无法表达 PATCH 的「省略=不动、显式 `null`=置空」；
- 对多对多关联是级联保存，无法精确表达「整体替换 / 清空 / 保留」。

```ts
transaction(async (session) => {
  const inserted = await session.query(
    "INSERT INTO sys_organization (name, code, logo) VALUES ($1, $2, $3) RETURNING id",
    [body.name, body.code, body.logo ?? null],
  );
  return findOne(clientFor(session), String(inserted.rows[0].id)); // 读回完整视图
});
```

- **只用 `$1, $2, ...` 占位符**，绝不拼接字符串。
- 自增主键不在 INSERT 里给值，用 `RETURNING id` 取回。
- 局部更新：`name = COALESCE($2, name)`（省略保留），`logo = CASE WHEN $4 THEN $5 ELSE logo END`（显式 null 置空）。
- 写操作返回**事务内重新读出的完整视图**，不是 SQL 片段拼出来的近似对象。

### 事务

`transaction((session) => ...)` 在同一个 `PoolClient` 上 `BEGIN`/`COMMIT`，异常自动 `ROLLBACK`。
回调内用 `clientFor(session)` 取 ts-grm 客户端——它钉住同一会话，**读得到本事务未提交的写**。

## 5. 模块写法

- `model.ts`：`Elysia.t` 定义并导出 `as const`，类型用 `UnwrapSchema` 推导，不另写 interface。
- `repository.ts`：导出对象；读经 `run(...)` 包装（统一错误分类），写经 `transaction(...)`。
- `service.ts`：业务规则；「不存在」抛 `ResourceNotFoundError`，不碰 Elysia。
- `index.ts`：工厂函数返回 `new Elysia({ name, prefix })`；1 实例 = 1 controller；
  ❌ 不要把整个 `Context` 传进 service。

### 域聚合（`modules/<领域>/index.ts`）

实体各一个工厂，域里再有一个聚合工厂：

```ts
// modules/rbac/index.ts
export function rbacModule() {
  return new Elysia({ name: "rbac" })
    .use(organizationModule())
    .use(permissionModule());
}
```

`app.ts` 因此只挂**域**，不挂实体：新增一个实体的 controller 不会动 `app.ts`。
路由前缀是两段 —— `modules/book/book` 挂在 `/book/books`，`modules/book/store`
挂在 `/book/stores`；文件名叫 `store` 而路由叫 `stores`，因为路由面对的是集合。

**每个工厂都必须调用。** 少写一对括号不报错，但会把整棵路由树挂错地方 —— 见第 9 节。
域内实体与域同名时（`book` 域里的 `book` 实体），导入时改名，别让两个 `bookModule`
撞在一起。

## 6. 应用组装与错误处理

### 认证：目前只有登录

`POST /auth/login` 拿邮箱与口令换一份用户信息（`{ id, name, email }`）。

**做了的：** 口令用 `Bun.password.verify` 比对；邮箱不存在与口令不匹配返回
**逐字相同**的 401 —— 分开报等于把“这个邮箱注册过”送给任何人，而登录是匿名可调的。

**没做的（有意）：** 没有 token、没有服务端会话、没有鉴权中间件，因此其他接口
**不校验调用者是谁**；前端也没有路由守卫。要加的时候，签发写在 `auth/service.ts`，
校验写成 `app.ts` 里挂在业务路由**之前**的一个插件；错误类型已在 `errors.ts` 就位。

- `app.ts` 只做：全局插件（CORS）、全局错误处理、**挂载各域的聚合插件**；业务逻辑一行不写。
- **`onError` 必须注册在 `.use(模块)` 之前**，否则插件路由里的异常会漏成框架默认响应。
- 统一错误体：

  | 状态 | 含义             | `code`                 |
  | ---- | ---------------- | ---------------------- |
  | 422  | 参数不合法       | `VALIDATION`           |
  | 404  | 接口或资源不存在 | `NOT_FOUND`            |
  | 409  | 唯一约束冲突     | `CONFLICT`             |
  | 422  | 外键引用无效     | `INVALID_REFERENCE`    |
  | 500  | 数据库凭据无效   | `DATABASE_AUTH_FAILED` |
  | 503  | 数据库暂时不可用 | `DATABASE_UNAVAILABLE` |
  | 500  | 未捕获异常       | 原始 `code`            |

- SQLSTATE → 领域错误的翻译**只在 `errors.ts`**；`app.ts` 只做领域错误 → HTTP 状态。
- 凭据被拒（配置错误，500）与暂时连不上（可重试，503）必须分开，且都要打日志。
- 健康检查要探**真实业务表**（`/health/db` → `ready()`），不要用 `SELECT 1` 当探针。

## 7. 配置与迁移

### 启动时初始化管理员

`src/index.ts` 在**监听之后**调 `ensureAdminUser()`（`modules/rbac/user/bootstrap.ts`）：
若不存在 `name = "admin"` 的账号，就用 `ADMIN_EMAIL` / `ADMIN_PWD` 建一个。

- **幂等，而且不覆盖。** 存在就什么都不做 —— 改过的密码不会在下次重启被悄悄
  重置回 `.env` 里的值。重置密码应该是显式动作，不是重启的副作用。
- **判据是名字不是邮箱。** 名字是“初始化过没有”的标记；代价是把 admin 改名
  之后会再建一个，这是有意的（想重跑就改名）。
- **失败不阻止启动。** 包在 try/catch 里，库没起时服务照常运行、由 `/health/db`
  如实报告。初始化是便利，不是启动的前置条件——这也是它放在监听之后的原因。
- **日志不打印口令。** 启动日志常常被收集和转发，只报名字与邮箱。
- 用户必须属于一个组织（列 NOT NULL）。取第一个组织；一个都没有时建一个
  “默认组织”，让全新库也能直接启动。
- 函数接受可注入的 `{ name, email, password }`，集成测试传自己的名字，
  不去碰真实的 admin。

**没有独立的 config 模块。** 应用侧直接读 `process.env`（Bun 会自动加载 `backend/.env`）。

迁移配置 `ts-grm-migrate.config.ts` 是独立入口：它跑在 Node 下（不会自动读 `.env`），
所以在文件内显式加载一次：

```ts
try {
  process.loadEnvFile?.(fileURLToPath(new URL("./.env", import.meta.url)));
} catch {
  /* 没有 .env 时用默认值 */
}
```

命令（`backend/` 内）：

```bash
bun run db:dev -n <名字>   # 生成并应用一个迁移
bun run db:deploy          # 应用所有待应用迁移（部署/CI）
bun run db:status          # 已应用 / 待应用
bun run db:check           # 模型与库是否漂移（有差异退出码 1）
bun run db:push            # 直接把库同步成模型形状（不写历史，仅本地）
```

- `migrations/` 纳入版本控制；已应用的迁移不要手改，要更正就新建一个。
- 改模型后跑 `db:check` 确认无遗漏再提交。

## 8. 测试

- 单测用 `app.handle(new Request(...))` 直接调用，**不监听端口**。
- 默认 `bun test` **不依赖数据库**；需要库的用例放 `tests/integration/`，用
  `PG_INTEGRATION=1` 显式开启，并自行清理它写入的数据。
- 集成测试**都放同一个文件**：`pool` 是全局单例，多个文件各自 `close()` 会把池
  提前关掉，后跑的用例就全崩。
- 同一个文件里也要小心：**`close()` 整份文件只调一次**。两个 `describe` 各自 `close()`，
  先跑完的那个会把池关掉，后一个 describe 的查询全部报
  `Cannot use a pool after calling end`。各 `describe` 清自己的数据，关闭放在文件级的
  一个 `afterAll` 里。

## 9. 上游已知限制（踩坑记录）

- **`prop.text()` 的列不能参与 WHERE。** 它生成的 DDL 和 `prop.str(n)` 完全一样（都是 `text`），
  但 scalarType 是 **TEXT**，而 ts-grm 只为 **STR** 生成表达式：
  `user.email.eq(...)` 直接抛 `ARGUMENT_ERROR: Cannot create table prop ... whose scalar type
is TEXT` —— **连 `eq` 都不行**，更不用说 `lower()` / `ilike()`。
  要按某一列查询或排序，就用 `prop.str(n)`。`SysUser.email` 与 `SysUser.name` 就是
  为此从 `text()` 改过来的。

  **这是上游的一个不一致，不是刻意的限制。** `prop.text()` 返回的就是 `__StrProp` ——
  与 `prop.str(n)` **同一个类型**，所以 `.eq` / `.ilike` / `.lower()` 在类型上全都有，
  TypeScript 不会拦；但它的 `scalarType.kind` 是 `"TEXT"`，而 `createTableProp()`
  的 switch 只处理 `I8/I16/I32/I64/NUM/F32/F64/STR/DATETIME`。`ScalarType.TEXT` 在
  整个 bundle 里只出现两次（定义，以及 `prop.text()` 里的那一次使用）——
  **没有任何配套的表达式实现**。

  在 PostgreSQL 上这纯粹是故障：两种 prop 生成的列**完全一样**（初始迁移里
  `sys_user.name` 用 `text()`、book 迁移里 `book.name` 用 `str(50)`，两处都是 `text`），
  所以一个明明可比较的列被 ORM 拒了。其他方言未必如此（Oracle 的 CLOB、SQL Server
  已弃用的 `text` 都不能直接 `=`），但这种差别本该由**方言的列类型**表达，而不是由
  一个方言无关的 kind 一刀切。

  **绕法是 `prop.str(n)`** —— 它在 PG 下不进 DDL（其他方言才用它生成 `varchar(n)`），
  因此改这一条不产生迁移。`SysUser.email` 与 `SysUser.name` 就是这么改的。

  > 可以自查，不必相信：把一个 `text` 列临时改成 `prop.i32()`，`tgm check` 会立刻报
  > 「列 X：类型应为 integer」—— 说明它**确实在比较列类型**。于是 `text()` → `str(n)`
  > 之后 check 仍说“一致”，就证明了生成的 SQL 类型没变。

- **`.use(工厂)` 与 `.use(工厂())` 不是一回事。** Elysia 见到函数就当 functional plugin，
  拿**当前实例**去调它；而我们的工厂忽略入参、返回新实例 —— 返回的那个实例成了新的根，
  **其后**所有 `.use()` 都嵌进了它的 prefix。实测得到一组
  `/rbac/organizations/rbac/views/`，症状是后几个模块集体 404、第一个模块正常。
  **一律写 `工厂()`。**
- **多对多只在拥有中间表的一侧写 `joinTable`**，另一侧用 `.mappedBy("对方的字段名")`。
  两侧各写一个 `joinTable` 不报错，但迁移工具会生成**两张中间表**：一张永远是空的，
  而写入只落进其中一张。
- **软删除会让关联“变得可能为 null”。** 全局过滤器按列名注册，**关联查询也被它管着**：
  软删除一个组织后，`GET /rbac/users/:id` 的 `organization` 读出来是 `null`；软删除书店后，
  图书的 `store` 同样是 `null`。所以 response schema 里，**任何指向可软删除实体的对象投影
  都要允许 null**（`t.Union([t.Object({ ... }), t.Null()])`），否则契约就与响应不符 —— 而
  Elysia 的 response 校验**不一定**替你发现（实测它老老实实返回了 200 + `null`）。
  列表形式的关联不会变成 `null`，但会**少几个**：已删除的成员从数组里消失。
- **`EntityManager.combine`** 的类型是「恰好两个」参数（`AtLeastTwo = [T, T]`），运行时却遍历全部
  入参；改用 `EntityManager.of(dir, path)` 扫描目录注册模型，避免这个限制。
- **`EntityManager.of`** 的 baseDir 必须是**已存在的目录**（否则抛 `ArgumentError`），
  模型路径必须是 `./` 或 `../` 开头的相对路径。
- **`fetchOptional()`** 在 `@ts-grm/core@0.0.13` 的返回类型被写成
  `A | B extends true ? ... : null`，实际只推导出 `null`。单条查询用
  `const [row] = await query.fetchList(); return row ?? null;` 代替。
- **`additionalProperties: false` 不会拒绝多余字段**：Elysia 会静默忽略。要严格拒绝得自己校验。
- **`SqlClient` 类型从 `@ts-grm/core` 导出**（不是 `@ts-grm/sql`）。
- `autoIncrement()` / `default()` 来自 `ts-grm-patches`，**每个定义模型的文件都要先调
  `applyPatches()`**，否则补丁不生效。
- **引用键成员是 camelCase**：`dto.view` 里直接 `c.parentId` 取外键，WHERE 里也写 `view.parentId`
  （不是下划线的 `parent_id`）。`$flat("parent")` **不是**取外键——它会把父模型的全部成员
  展平成 `parentName` / `parentPath` … 一整套。
- **`createGlobalFilterManager`**（≥0.2.1）接受 `EntityManager`，模型清单由它的 `entities()` 汇总，
  不必手写；**它是异步的**，要用顶层 await 在构造客户端之前注册完。
- 前端 Eden Treaty 需要路由声明 **response schema** 才能收敛 `data` 类型；只写 handler 返回值
  时，全局 `onError` 的错误体会被并进 `data`。

## 10. 交付检查

```bash
bun run --filter @ts-fullstack-ts-grm/backend typecheck
bun run --filter @ts-fullstack-ts-grm/backend test
```

改动模型、SQL、路由或错误处理后，还要真实跑一遍：

```bash
bun run db:check
cd backend && PG_INTEGRATION=1 bun test tests/integration
PORT=3100 bun run --filter @ts-fullstack-ts-grm/backend start
curl -i http://localhost:3100/health/db
```
