# 前端开发指引

修改本目录前先阅读本文件，详细约束见[前端文档](./docs/README.md)。

## 项目定位

这是全栈仓库中的 Vue 3 管理端，使用 TypeScript、Vite、Tailwind CSS v4、Pinia、Vue Router、shadcn-vue、Reka UI 和 Vitest。已有真实接口、认证、角色授权和动态导航，开发时保持组件、交互与主题一致。

## 命令与完成标准

以下命令在 `frontend/` 执行：

```bash
bun run check        # 类型、格式、代码规则、单测、构建和浏览器检查
bun run test         # 规范检查、纯逻辑与组件交互
bun run test:browser # 布局溢出、操作反馈、导航、表单与流程
bun run typecheck    # 类型检查
bun run lint         # 格式与代码规则检查
bun run format       # 格式化
bun run build        # 类型检查与构建
bun dev              # 开发服务
```

完成变更前必须运行 `bun run check`。布局、宽度和表单变更必须通过真实浏览器检查，只有浏览器具有实际布局引擎。首次运行需要 `bunx playwright install chromium`。

## 自动检查的规则

1. 页面通过 `PageHeader` 提供唯一主标题，不另外渲染 `<h1>`。使用 `ResourceListView` 的页面由共享组件提供标题。
2. 数据卡片标题使用 `text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase`。
3. 平面表格提供 `DataPagination`，页面不自行切片分页；完整视图树使用已明确的例外。
4. `src/components/data/` 不导入 store 或路由。
5. 每种强调色同时定义浅色、深色和 `index.html` 防闪烁脚本允许值。

检查失败时修正实现，不绕过规则。

## 需要审查的规则

- 字段内部使用 `gap-3`，字段之间使用 `gap-7`，弹窗字段间允许 `gap-5`。
- 普通页面使用 `p-4 space-y-4`，总览使用 `p-4 md:p-6 space-y-6`。
- 占位符为输入示例，不代替标签。
- 错误使用 `aria-invalid`，不手写错误颜色。
- 数字使用 `tabular-nums`，技术值使用 `font-mono`。
- 图标按钮同时提供 `aria-label` 和 `Tooltip`。
- 无数据和筛选无结果分别提供状态与出口。
- 可交互控件支持键盘、显示手形光标并有悬停反馈；禁用状态除外。
- 页面在各宽度下不横向溢出，浏览器检查覆盖代表性宽度。
- 菜单只展开或折叠，页面只导航，菜单点击不改变 URL。

完整原因与示例见[设计原则](./docs/principles.md)。

## 强制约束

- **具体类型**：内部数据与回调必须有对应类型，优先从校验模型、变量和框架导出类型推导。不得用 `any`、`unknown` 省事，也不通过断言或检查抑制绕过类型问题。必要边界例外说明原因，验证并收窄后再进入业务代码，详见[类型约束](./docs/constraints.md#类型约束)。
- **公司顶栏**：每页保留 `AppTopbar`，醒目居中显示 `src/config/brand.ts` 中的公司全称；使用语义变量，不加英文副标题。小屏长名称换行，不与控件重叠或溢出。
- **颜色统一**：所有颜色通过 `src/assets/main.css` 的语义变量提供，不新增硬编码颜色。
- **字号下限**：不低于 14px；页面标题、卡片与分区标签、品牌、导航和表头等关键文字从 16px 起。
- **基础组件复用**：shadcn-vue 已有的组件通过命令添加，不自行重写。`components/ui/` 中的本地修改在重新生成前检查。
- **纯逻辑分层**：业务循环、过滤、排序和校验放在 `src/lib/`，必要测试与模块相邻。纯模块不依赖 store 或路由；允许资源元数据使用组件类型及 `markRaw`。
- **等待写入**：异步写入必须等待并提供处理中、禁用与失败状态。
- **浏览器访问时机**：模块加载和组件初始化阶段不直接访问 `window`、`document`；DOM 操作放在浏览器生命周期或事件中。
- **Git 操作**：只进行本地提交，不推送；不丢弃未经确认的未提交修改。

## 代码入口

| 需求                 | 文件                                                              |
| -------------------- | ----------------------------------------------------------------- |
| 共享资源列表         | `src/components/data/ResourceListView.vue`                        |
| 资源配置和请求页面   | `src/views/library/BooksView.vue`                                 |
| 共享表单             | `src/components/rbac/ResourceFormDialog.vue`                      |
| 表格分页             | `src/components/data/DataPagination.vue`                          |
| 导航纯规则和菜单组件 | `src/lib/nav.ts`、`src/components/layout/SidebarMenuGroup.vue`    |
| 资源与分页逻辑       | `src/lib/resource.ts`、`src/lib/rbac.ts`、`src/lib/pagination.ts` |
| 主题样式             | `src/assets/main.css`                                             |
| 设计规范检查         | `src/lib/design-system.test.ts`                                   |

## 添加页面

1. 创建 `src/views/<Name>View.vue`。资源页面参考图书页，连接资源配置和请求后渲染 `ResourceListView`；普通页面使用[开发流程](./docs/workflow.md#添加页面)中的标题和容器结构。
2. 在 SysView 创建视图，配置组件与路径并授予角色。路由和侧栏由 `GET /auth/me/access` 派生。
3. 新资源增加类型明确的请求适配与操作权限，参考[全栈扩展指南](../docs/extending.md)。
4. 执行 `bun run check`；服务端变更按需运行独立数据库集成与全栈浏览器测试。

## 常见问题

`parseDate` 对非法日期抛异常；`renderToString` 是异步函数；弹窗通过传送机制进入 `document.body`；测试中的 `Tooltip` 需要 `TooltipProvider`。

- 数字输入的 `v-model` 可能返回 number，按 `string | number` 接收并归一化。
- `AlertDialogAction` 可能在点击处理前关闭弹窗，异步删除用普通 `Button`，成功后主动关闭。
- 所有表单使用 `novalidate`，避免浏览器原生校验阻止自己的提交处理；小数控件设置正确 `step`。
- Tailwind CSS v4 不使用传统配置文件，按钮手形光标在基础样式层统一恢复。
- 应用高度使用 `h-dvh`，宽内容的弹性布局子项使用 `min-w-0`，滚动区域使用 `min-h-0`。

完整清单见[常见问题](./docs/workflow.md#常见问题)。
