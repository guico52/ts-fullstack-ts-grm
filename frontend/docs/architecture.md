# 前端架构

## 目录与职责

- `src/views/`：总览、登录、404、system/ 五个资源页面与 library/ 三个资源页面。
- `src/components/ui/`：基础控件；`components/layout/`：外壳；`components/data/`：共享列表与分页；`components/rbac/`：表单与视图树。
- `src/lib/`：资源元数据、请求适配、导航转换、校验和分页逻辑。
- `src/composables/`：页面请求状态（useResource）和操作权限（useResourceActions）。
- `src/stores/`：auth 会话、access 可达集合、theme 主题与 ui 外壳状态。
- `src/router/`：固定登录及 404 路由、登录守卫和动态路由注册。

页面负责连接请求与展示组件。展示组件通过 props 接收数据、回调和权限，components/data/ 不导入 store 或 router。
lib/ 不依赖 Pinia 实例；资源 spec 和导航条目可以引用 Vue 组件类型及 markRaw，不能笼统视为完全无 Vue 依赖。

## 请求与类型

唯一客户端为 `src/lib/api.ts`，类型从 backend/src/app.ts 推导。
通用表单产生 ResourceFormValues（字段来自后端 schema，值为控件标量或 ID 数组），`src/lib/resource-api.ts` 检查字段的运行时类型并返回后端 schema 推导的 createBody / updateBody。
适配器不使用 as never 或 as any；新增必填字段必须调整适配器，Treaty 调用继续检查接口类型。字符串长度、引用有效性和业务规则由后端最终校验。

内部数据与回调必须保留对应类型，不用 `any`、`unknown` 简化实现。具体类型来源、外部边界验证和必要例外遵循[类型约束](./constraints.md#类型约束)；后端遵循同样的[类型约束](../../backend/docs/constraints.md#类型约束)。

## 会话、导航与授权

登录后将 JWT 会话保存在 localStorage，读取 GET /auth/me/access，再注册该用户的页面。
刷新时重新加载可达集合；登出清除会话、权限与动态路由。UI 守卫不承担安全边界，后端逐次验证 token 与权限。
JWT 无撤销接口；登出不会使复制出去的 token 失效。不要把本地 signedIn 作为授权依据。

auth 保存会话，theme 保存主题及强调色，ui 保存侧栏收起与关闭的菜单；access 不持久化，移动端抽屉不持久化。
localStorage 异常由 storage.ts 捕获。当前请求 token 从 storage 读取，浏览器禁用 storage 时无法保持认证请求。

## 扩展

新增组件自动进入 views-catalog，路由与导航来自角色绑定的 SysView 数据，无须手写静态业务路由。
新增模块完整流程见[全栈扩展指南](../../docs/extending.md)。
DOM 操作应在生命周期或事件中执行；基础组件会由 SSR 测试验证，不在模块顶层直接访问 window / document。
