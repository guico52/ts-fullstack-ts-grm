# 前端架构

## 目录与职责

- `src/views/`：总览、登录、404、我的信息、修改密码、系统管理五个资源页面与图书管理三个资源页面。
- `src/components/ui/`：基础控件；`components/layout/`：外壳；`components/data/`：共享列表与分页；`components/rbac/`：表单、密码重置与视图树。
- `src/lib/`：资源元数据、请求适配、类型、导航转换、校验和分页逻辑。
- `src/composables/`：页面请求状态（`useResource`）和操作权限（`useResourceActions`）。
- `src/stores/`：会话、可达集合、主题与界面外壳状态。
- `src/router/`：固定账号及错误页面路由、登录守卫和动态业务路由注册。

页面连接请求与展示组件，展示组件通过属性接收数据、回调和权限；`components/data/` 不导入状态或路由实例。

纯逻辑不依赖 Pinia 实例；资源配置和导航条目可以引用 Vue 组件类型及 `markRaw`，因此不能笼统要求整个 `lib/` 完全不依赖 Vue。

## 请求与类型

唯一客户端为 `src/lib/api.ts`，类型从 `backend/src/app.ts` 推导。

通用表单产生 `ResourceFormValues`，字段来自后端校验模型，值限于控件标量或 ID 数组。`src/lib/resource-api.ts` 验证字段的运行时类型，返回后端校验模型推导的创建或更新请求体。

适配器不使用 `as never` 或 `as any` 绕过检查；新增必填字段必须调整适配器，Treaty 调用继续验证接口类型。字符串长度、引用有效性和业务规则由后端最终校验。

内部数据与回调必须保留对应类型，不用 `any`、`unknown` 简化实现。类型来源、外部边界验证和必要例外遵循[类型约束](./constraints.md#类型约束)，后端遵循相同的[类型约束](../../backend/docs/constraints.md#类型约束)。

## 会话、导航与授权

登录后将 JWT 会话保存在 `localStorage`，读取 `GET /auth/me/access`，再注册该用户可访问的业务页面。刷新时重新加载可达集合；退出时清除会话、权限与动态路由。前端可见性不承担安全边界，后端每次验证凭据和权限。

JWT 没有独立会话撤销接口；修改或重置密码使该用户全部旧凭据失效，退出只清除当前浏览器会话。本地 `signedIn` 不作为授权依据。

`auth` 保存会话，`theme` 保存主题和强调色，`ui` 保存侧栏收起状态与关闭的菜单。`access` 不持久化，移动抽屉打开状态不持久化。

存储异常由 `storage.ts` 捕获。请求凭据从存储读取，浏览器禁止存储时无法保持认证请求。

## 扩展

新增组件自动进入页面目录，路由与导航来自角色绑定的 SysView 数据，不另外维护静态业务路由。新增模块流程见[全栈扩展指南](../../docs/extending.md)。

DOM 操作在生命周期或事件中执行；服务端渲染测试验证基础组件，模块加载阶段不直接访问 `window` 或 `document`。
