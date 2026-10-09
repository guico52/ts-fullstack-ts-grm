# 后端对接（Eden Treaty）

前端调用后端的唯一入口是 [`src/lib/api.ts`](../src/lib/api.ts)。

## 为什么没有 HTTP 客户端库

没有 axios，也没有手写的 fetch 封装。类型从后端的路由定义直接推导
（[Eden Treaty](https://elysiajs.com/eden/overview.html)）：请求路径、参数、返回值
是同一份真相。多一层封装，就多一处会和后端漂移的地方。

## 类型从哪里来

`backend/src/app.ts` 导出应用的完整类型：

```ts
export type App = ReturnType<typeof createApp>
```

`backend/package.json` 的 `exports` 指向这个文件，于是前端可以：

```ts
import type { App } from "@ts-fullstack-ts-grm/backend"
```

注意它指向 `app.ts` 而不是 `index.ts`：导入类型不会监听端口，启动逻辑只在
`index.ts`。

## 前端侧的两个前提

`frontend/package.json` 里这两项是链路的组成部分，不要删：

- `"@ts-fullstack-ts-grm/backend": "workspace:*"` —— bun workspace 只有**显式声明**
  依赖才会建立 `node_modules` 链接。缺了它，包名解析不到，报错是
  `Cannot find module '@ts-fullstack-ts-grm/backend'`。
- `"elysia"`（devDependency）—— Eden 的类型内部引用 Elysia 类型；前端不能解析它时，
  treaty 的泛型会退化成 `"Please install Elysia before using Eden"`，随后所有路由
  访问都报"属性不存在"。

## 用法

```ts
import { api } from "@/lib/api"

const { data, error } = await api.health.get()
if (error) {
  // 后端可达，但返回了错误状态
} else {
  data.uptime // 有类型，来自后端
}
```

路径即路由：`/health/db` → `api.health.db.get()`；`/rbac/organizations/:id` → `api.rbac.organizations({ id }).get()`。

## 错误处理：Treaty 不抛异常

这是最容易写错的一处。**连接被拒、超时这类传输层失败不会 throw**，而是进入
`error` 分支：

```ts
{
  data: null,
  error: { status: 503, value: { code: "ConnectionRefused", path: "http://…/health" } },
  status: 503,
}
```

所以 `try/catch` 兜不住"后端没启动"。判断后端不可用要看 `error`；而且**单看
`error.status` 会误导**——503 看上去像服务器答复了，其实连接根本没建立。要读
`error.value.code`。`src/lib/api.ts` 的 `describeApiError` 把这几层收敛成一个可显示的
字符串。

`try/catch` 仍然保留，用于兜非协议层面的异常。

## 约定

- 不要在 `src/lib/api.ts` 之外直接 `fetch` 后端，也不要新建第二个 treaty 实例。
- 后端地址来自 `VITE_API_URL`（见 [`../.env.example`](../.env.example)），默认
  `http://localhost:3000`。不要在组件里硬编码地址。
- 后端改 schema 后前端 typecheck 会立刻报错——这是设计意图，不要用 `as any` 绕过。
- 后端新增路由后不需要生成任何代码，重新 typecheck 就能看到新方法。

## 怎么确认这条链路真的连着

```bash
# 1. 类型层：后端改一个字段，前端必须编译失败。
#    想手动验证，就在前端写一句访问错误字段的代码，vue-tsc 应报错。
bun run --filter @ts-fullstack-ts-grm/frontend typecheck

# 2. 运行时：完整验证前端自己的客户端与真实后端。
#    使用独立测试库，先按根 docs/testing.md 配置并迁移。
bun run test:e2e
```

第 2 步通过真实浏览器登录，前端客户端自动携带 token，后端验证权限，覆盖完整链路。

## 通用资源表单的类型边界

resource-api.ts 对 unknown 字段做运行时形状校验，返回后端 schema 推导的请求类型。禁止 as never / as any 绕过请求契约。服务端继续验证长度、枚举和引用规则。
