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

### 类型约束

- 内部数据、数据库投影、插件实例、上下文和回调必须有对应的类型。优先从模型、校验模型、已定义变量和框架类型推导；推导准确时不要求重复标注，也不另写一份重复的接口定义。
- 导出需要复用的变量类型，例如 `src/plugins/auth.ts` 的 `AuthGuardType = typeof authGuard`；上下文从 `InferContext<AuthGuardType>` 派生。插件实例与请求校验回调是不同的类型，`PermissionCatalog` 的 `permissionCheck` 使用对应的 `PermissionCheck`，不能用 `unknown` 代替。
- 请求体类型由 Elysia 校验模型推导，查询结果由 ts-grm 投影推导；原生 `pg` 查询需要定义对应结果类型。新增字段、钩子或返回值时同步维护类型，不把已知结构写成 `any`、`unknown` 或宽泛的 `Record<string, unknown>`。
- 非必要情况下禁止使用 `any`、`unknown`。不能为了消除类型错误把 `any` 换成 `unknown`，也不能通过 `as any`、`as never`、`as unknown as T` 或类型检查抑制绕过约束；应修正类型来源、收窄联合类型或完善适配器。
- `unknown` 仅用于确实无法预知结构的边界，例如未经验证的 JSON、捕获的异常和外部库返回值。使用处须说明边界原因，通过校验模型、类型守卫或属性检查完成验证和收窄，再传入内部业务代码；类型断言不能代替验证。
- `any` 仅在第三方类型缺陷等无法合理消除的限制下允许局部例外，须在使用处说明原因和影响范围，封装后向业务层提供具体类型。
- 泛型用于保留真实的输入与输出关系，不作为逃避类型建模的替代品。测试故意传入非法数据时，可局部使用附有原因的 `@ts-expect-error`，同时验证静态拒绝与运行时处理；生产代码不得照搬。
- TypeScript 检查不能证明每处 `unknown` 都必要；上述必要性、验证是否充分及例外范围由代码审查判断。

## 2. 目录与分层

```
src/
├── model/                     模型 + 数据库入口
│   ├── index.ts               EntityManager.of、全局过滤器、连接池、client、事务
│   ├── embedded.ts            公共嵌入字段（auditFields）
│   ├── rbac/index.ts          按领域分的模型文件
│   └── book/index.ts          一个领域一个文件
├── modules/<领域>/            业务模块，一个领域一个目录
│   ├── index.ts               域聚合：把该域的路由控制器合成一个插件
│   └── <实体>/
│       ├── model.ts           校验模型
│       ├── repository.ts      读 ts-grm / 写原生 pg
│       ├── service.ts         业务规则
│       └── index.ts           Elysia 路由控制器
├── plugins/                   跨领域的自定义 Elysia 插件（与 modules 同级）
├── errors.ts                  领域错误 + SQLSTATE 分类
├── app.ts                     组装：插件 + 错误处理 + 挂模块
└── index.ts                   进程入口
```

当前三个领域：`rbac`（org / user / view / role / permission）、`book`
（book / author / store）与 `auth`。

**域里只有一个实体时不再套一层。** `modules/auth/` 直接把
`model / repository / service / index` 四个文件放在域目录下 —— 域聚合层是为
“一个域有多个路由控制器”准备的，为一个接口造三层目录只是形式。

依赖方向单向前进，不允许反向或跨层：

```
index → service → repository → model/index（client、事务）
  ↘        ↓           ↓
       model.ts（校验模型与类型）
```

- ❌ `service` / `index` 里出现 SQL、`import "pg"`、`import "@ts-grm/..."` 或 `Context`
- ❌ `index` 绕过 service 直接访问数据库
- ❌ `repository` 做业务判断或抛 HTTP 错误
- ❌ 另起一处 `new Pool()` 或 `newSqlClient()`——连接与客户端只此一份

## 3. 模型与数据库入口（`src/model/`）

- 模型是数据库结构的**唯一来源**：查询投影与迁移 DDL 都由它推导，没有第二份结构定义文件。
- 一个领域一个文件（如 `rbac/index.ts`），公共字段用嵌入组合（`audit = auditFields`）。
- 每个定义模型的文件在顶部调用一次 `applyPatches()`——必须在 `model()`/`prop` **之前**。
- **字符串列用 `prop.str(n)` 还是 `prop.text()`，只看一件事：这一列会不会被用来找某一行。**

  | 这一列…                                                                                | 用            |
  | -------------------------------------------------------------------------------------- | ------------- |
  | 会出现在 WHERE / ORDER BY（名字、编码、路由、权限标识…）                               | `prop.str(n)` |
  | 只被读出来、在**应用层**处理（`pwd_hash` 交给 `Bun.password.verify`，`logo` 是个 URL） | `prop.text()` |

  保持 `text()` 的列要在模型里**逐列注明理由**——否则下一个人分不清那是设计还是漏改。
  `n` 以对应 Elysia 校验模型的 `maxLength` 为准，让“能存多长”只有一处说法；
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
- `index.ts`：工厂函数返回 `new Elysia({ name, prefix })`；每个实例对应一个路由控制器；
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

`app.ts` 因此只挂**域**，不挂实体：新增一个实体的路由控制器不会动 `app.ts`。
路由前缀是两段 —— `modules/book/book` 挂在 `/book/books`，`modules/book/store`
挂在 `/book/stores`；文件名叫 `store` 而路由叫 `stores`，因为路由面对的是集合。

**每个工厂都必须调用。** 少写一对括号不报错，但会把整棵路由树挂错地方 —— 见第 9 节。
域内实体与域同名时（`book` 域里的 `book` 实体），导入时改名，别让两个 `bookModule`
撞在一起。

## 6. 应用组装与错误处理

### 认证与授权

`POST /auth/login` 拿邮箱与口令换 `{ id, name, email, mustChangePassword, token }`。登录凭据为 JWT
（`@elysiajs/jwt`，有效期 7 天，密钥来自 `JWT_SECRET`）。

**做了的：**

- 口令用 `Bun.password.verify` 比对；邮箱不存在与口令不匹配返回
  **逐字相同**的 401 —— 分开报等于把“这个邮箱注册过”送给任何人，而登录是匿名可调的。
- 签发在**路由层**：`authService` 不认识 Elysia 上下文，也不该认识。
- `JWT_SECRET` 在**生产环境缺失时启动就报错** —— 用公开默认值签发凭据，
  等于谁都能伪造登录凭据。开发环境允许缺省，但会打印警告。
- `plugins/auth.ts` 的 `authGuard` 校验 Bearer 登录凭据与数据库 tokenVersion，从数据库读取当前身份放进 `ctx.user`。

**业务路由已启用认证与授权：**

- app.ts 在业务模块前挂载 authGuard 与 permissionGuard。匿名请求返回 401，缺少权限返回 403。
- GET /auth/me/access 返回角色汇总的视图与权限；前端据此创建导航、动态路由和操作按钮。
- 每个请求重新读取权限，软删除角色或移除授权后无需等待登录凭据过期。
- 新接口默认从 method + 路由模板生成权限，无需登记前缀或 seed；权限目录由 plugins/permission-catalog.ts 托管。固定权限标识与豁免仅配置例外，见[权限说明](../../docs/permissions.md)。
- JWT 无服务端会话表；修改或重置密码原子递增 tokenVersion，旧 JWT 失效。前端登出仅清除本地凭据。

- `app.ts` 只做：全局插件（CORS）、全局错误处理、**挂载各域的聚合插件**；业务逻辑一行不写。
- **`onError` 必须注册在 `.use(模块)` 之前**，否则插件路由里的异常会漏成框架默认响应。
- 统一错误体：

  | 状态 | 含义             | `code`                 |
  | ---- | ---------------- | ---------------------- |
  | 401  | 凭据缺失或无效   | `UNAUTHORIZED`         |
  | 403  | 缺少操作权限     | `FORBIDDEN`            |
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

### 原始数据（`modules/rbac/seed.ts`）

每次启动调 `seedSystemData()`，**幂等**：按名字找，缺什么建什么，已有的一律不动。

- **默认视图**：总览、系统管理菜单和五个页面、图书管理菜单和三个页面，共 11 个。创建角色之前先创建全部视图。
- **权限点**：插件从实际路由生成；示例保留 `<scope>.<资源>.<动作>` 的 33 个固定权限标识，新接口默认使用 `METHOD:/route`。初始化过程只读取目录配置角色。
- **两个内置角色**：
  - **管理员** —— 全部视图 + 全部权限。
  - **观察者** —— 图书管理下的 4 个视图 + `book.*.read` 三个权限。

  “不可访问系统管理页面”由**绑定的视图里没有它**决定；“不能删除和修改”由
  **权限集合里只有 read** 决定。两者都是数据的**形状**，而不是一句说明 ——
  服务端每次请求验证权限，前端根据可达集合配置路由与操作按钮。

**内置角色只在缺失时创建，不覆盖已有绑定。** 管理员“拥有全部”是**初始化那一刻**的
全部：之后新加一个页面，它不会自动进管理员角色。角色绑定向来可以被人编辑，
每次启动都把它推回某个全集，等于把用户的编辑当成了错误。（改名会让它按新名字重新创建。）

### 启动时初始化管理员

`src/index.ts` 先同步完整权限目录，再调用 `seedSystemData()` 创建默认视图与角色，并调用 `ensureAdminUser()`，完成后才监听。

- 首次创建使用 `ADMIN_EMAIL` / `ADMIN_PWD`，组织不存在时自动创建默认组织；生产密码由部署环境提供。
- `initial_admin` 是持久标记，包含软删除记录。改名、撤权和软删除不会触发重建，也不会恢复角色绑定。
- 创建账号与首次角色绑定在同一事务中；事务协作锁防止并发重复初始化。
- 未配置管理员凭据则跳过管理员创建；目录同步或初始化失败阻止监听，不提供半初始化服务。
- 日志不打印密码。参数 `{ email, password }` 只用于注入首次凭据。
- 后续初始化不恢复已撤销的权限。已有项目自行维护升级迁移与角色授权。

完整密码接口及会话撤销规则见[密码管理](../../docs/passwords.md)。

### 配置与迁移

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
bun run db:deploy          # 应用所有待应用迁移（部署）
bun run db:status          # 已应用 / 待应用
bun run db:check           # 模型与库是否漂移（有差异退出码 1）
bun run db:push            # 临时结构实验（不记录 SQL，不用于项目初始化）
```

- 模板不附带开发过程的历史 SQL。首次开发使用空数据库，运行 `db:dev -n init` 生成并应用初始迁移，将 `migrations/` 中的 SQL 纳入新项目版本控制。后续结构变更继续生成迁移，已有迁移的新开发库、测试库和部署环境用 `db:deploy` 应用；已应用的迁移不要手改，要更正就新建一个。`db:push` 仅用于临时结构实验，不用于项目初始化或常规开发。
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

  在 PostgreSQL 上这纯粹是故障：两种 prop 生成的列**完全一样**（分别用 `text()`
  和 `str(50)` 定义列，模型生成的 SQL 类型都是 `text`），
  所以一个明明可比较的列被 ORM 拒了。其他方言未必如此（Oracle 的 CLOB、SQL Server
  已弃用的 `text` 都不能直接 `=`），但这种差别本该由**方言的列类型**表达，而不是由
  一个方言无关的 kind 一刀切。

  **绕法是 `prop.str(n)`** —— 它在 PG 下不进 DDL（其他方言才用它生成 `varchar(n)`），
  因此改这一条不产生迁移。`SysUser.email` 与 `SysUser.name` 就是这么改的。

  > 可以自查，不必相信：把一个 `text` 列临时改成 `prop.i32()`，`tgm check` 会立刻报
  > 「列 X：类型应为 integer」—— 说明它**确实在比较列类型**。于是 `text()` → `str(n)`
  > 之后 check 仍说“一致”，就证明了生成的 SQL 类型没变。

- **`.use(工厂)` 与 `.use(工厂())` 不是一回事。** Elysia 见到函数就当函数式插件，
  拿**当前实例**去调它；而我们的工厂忽略入参、返回新实例 —— 返回的那个实例成了新的根，
  **其后**所有 `.use()` 都嵌进了它的 prefix。实测得到一组
  `/rbac/organizations/rbac/views/`，症状是后几个模块集体 404、第一个模块正常。
  **一律写 `工厂()`。**
- **多对多只在拥有中间表的一侧写 `joinTable`**，另一侧用 `.mappedBy("对方的字段名")`。
  两侧各写一个 `joinTable` 不报错，但迁移工具会生成**两张中间表**：一张永远是空的，
  而写入只落进其中一张。
- **软删除会让关联“变得可能为 null”。** 全局过滤器按列名注册，**关联查询也被它管着**：
  软删除一个组织后，`GET /rbac/users/:id` 的 `organization` 读出来是 `null`；软删除书店后，
  图书的 `store` 同样是 `null`。所以响应校验模型里，**任何指向可软删除实体的对象投影
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
- 前端 Eden Treaty 需要路由声明 **响应校验模型** 才能收敛 `data` 类型；只写处理函数返回值
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

### 权限记录

`SysPermission` 仅以 `code` 表示权限，不另设显示名称。`code` 唯一，`url + method` 联合唯一；旧记录的接口字段允许为空。角色授权仍绑定 `id`，已有项目调整权限字段时，应自行编写保留原标识和关联的迁移。`deprecated` 记录保留在管理列表中，但不参与有效授权。权限目录托管插件位于 `src/plugins/permission-catalog.ts`，同步只新增、更新或标记废弃，删除由管理员显式执行。默认生成规则、定位变更与部署范围见[权限说明](../../docs/permissions.md)。

若将来采用路由派生 code，路由可能变动的接口应在变动前显式固定原 code，避免失去原有授权。
