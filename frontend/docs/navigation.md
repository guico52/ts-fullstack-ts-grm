# 导航

侧栏入口分为页面和菜单，两者的区别是行为契约：

| 入口         | 行为                                 |
| ------------ | ------------------------------------ |
| 页面（View） | 叶子节点，点击后导航                 |
| 菜单（Menu） | 父节点，点击后展开或折叠，不改变地址 |

菜单同时展开和导航会使点击结果难以预测，因此使用不同组件表达两种行为。`tests/browser/navigation.spec.ts` 验证点击菜单后 URL 保持不变。

## 添加页面

导航唯一数据源是 `GET /auth/me/access`。`access.ts` 将 SysView 的 `MENU`、`VIEW` 转成侧栏树，`BUTTON` 不进入侧栏。

在 `views/` 下创建组件后，在视图管理中创建页面，选择组件并设置 `path`，再给角色绑定视图及资源权限。`views-catalog` 自动发现组件，路由根据 `componentName` 注册；找不到组件时不会注册对应路由。

默认总览地址为 `/`，系统页面位于 `/system/`，图书页面位于 `/library/`。详见[扩展指南](../../docs/extending.md)。

## 展开状态

1. **菜单默认展开。** 新增分区应当直接可见。
2. **持久化关闭集合。** 如果保存展开集合，后来新增的菜单反而会默认关闭。
3. **访问关闭菜单内的页面时展开父菜单。** 侧栏必须显示当前页面的位置。

```ts
const closedMenus = ref<string[]>(readStringArray(CLOSED_MENUS_KEY))
const isMenuOpen = (id: string) => !closedMenus.value.includes(id)

watch(
  () => route.path,
  (path) => ui.revealPath(path),
  { immediate: true },
)
```

偏好读写通过 `lib/storage.ts`。读取失败或格式非法时回退，不让布局偏好导致页面启动失败。

## 折叠图标栏

侧栏整体折叠用于节省空间，与菜单展开状态独立：页面保留图标和提示，菜单变成列出子页面的 `DropdownMenu`。

64px 图标栏无法直接呈现嵌套列表，浮出菜单可以保持子页面可达，避免悬停时突然改变布局。包含当前页面的菜单在折叠状态下仍保留活动标记。

## 可访问性

- 菜单按钮提供 `aria-expanded` 和指向分组 `id` 的 `aria-controls`。
- 子分组使用 `v-show` 保留 DOM 结构；折叠时仍遵循浏览器对隐藏元素的可访问性处理，不意味着隐藏内容可被辅助技术读取。
- 浮出菜单触发器提供 `aria-haspopup="menu"`。
- 当前页面入口提供 `aria-current="page"`。

## 测试覆盖

导航浏览器测试检查菜单展开、折叠且不改变 URL，`aria-controls` 指向唯一元素，进入关闭菜单内的页面后自动展开，手动关闭状态在刷新后保留，页面入口实际导航，侧栏链接对应真实页面，折叠栏菜单及子页面仍可使用，活动标记保持正确。

这些断言分别验证行为，不应通过删除其他断言掩盖某一项失败。

## 层级范围

当前侧栏采用菜单下包含页面的两级结构，按钮节点不参与导航。增加更深层级前，先评估信息架构和折叠图标栏的交互；数据可描述层级不等于现有界面已经支持任意深度。

## 服务端决定可达页面

侧栏和动态路由使用同一份数据：

```text
/auth/me/access → { views: [...], permissions: [...] }
        │
        ├─→ stores/access.ts 的 navEntries → 侧栏
        └─→ registerAccessRoutes() → router.addRoute
```

`lib/nav.ts` 不维护静态业务导航表，只保留导航类型与 `isMenu`、`isActivePath`、`menuContaining` 等纯规则。前端未注册的页面落到 404；实际接口访问权限仍由后端验证。

### 刷新与切换账号

- 刷新后会话可能还在 `localStorage`，动态路由却已消失。守卫先加载可达集合、注册路由，再重新解析当前地址；`loaded` 状态防止重复加载循环。
- 退出时必须调用 `clearAccessRoutes()` 清除动态路由，避免较低权限的新账号沿用上一账号的页面。
- 登录后前往第一个可访问页面，即 `access.landingPath`；固定跳转 `/` 会使没有总览授权的用户进入 404。

### 页面地址

页面实际地址来自 `sys_view.path`。`views-catalog` 根据组件名派生的地址只作为表单默认值，修改已配置页面地址应修改视图数据。
