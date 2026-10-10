# 前端开发流程

## 常用命令

以下命令在 `frontend/` 目录执行：

```bash
bun dev                 # 开发服务器，默认端口 5173
bun run check           # 按顺序执行完整检查，默认使用此命令
bun run typecheck       # 类型检查，不生成代码
bun run lint            # 格式与代码规则检查
bun run test            # 规则检查、纯逻辑与组件交互测试
bun run test:watch      # 持续运行单元测试
bun run test:browser    # 构建后检查布局、交互、导航与操作流程
bun run test:browser:run # 对现有 dist/ 运行浏览器测试
bun run build           # 类型检查与生产构建
bun run preview         # 提供 dist/ 的预览服务
```

`check` 依次执行 `typecheck && lint && test && vite build && test:browser:run`，类型检查和构建各执行一次。独立的 `build` 也会检查类型，`test:browser` 使用它生成新的生产产物。

首次运行浏览器测试前安装 Chromium：

```bash
bunx playwright install chromium
```

需要添加 shadcn-vue 基础组件时使用：

```bash
bunx shadcn-vue@latest add <name> --yes --overwrite
```

重新生成组件前检查已有本地修改，避免覆盖。完成变更前运行 `bun run check`；间距、宽度和表单变更必须通过真实浏览器检查，单元测试没有布局引擎。

只修改测试时，可以构建一次，再用 `bun run test:browser:run tests/browser/navigation.spec.ts` 迭代。应用源码变更后必须重新构建；`test:browser:run` 使用已有 `dist/`，不会自动更新产物。

## 添加页面

1. 创建 `src/views/<Name>View.vue`，普通页面使用以下结构：

   ```vue
   <script setup lang="ts">
   import PageHeader from "@/components/layout/PageHeader.vue"
   </script>

   <template>
     <div class="p-4 space-y-4">
       <PageHeader title="页面名称" subtitle="说明页面用途。" />
     </div>
   </template>
   ```

2. 资源页面参考 `src/views/library/AuthorsView.vue`，组合资源配置、请求和 `ResourceListView`；由共享列表提供 `PageHeader`，不要重复添加。
3. 在视图管理中创建页面，选择组件与路由，绑定到角色。导航和路由由可达集合派生。
4. 新资源增加校验模型推导类型、请求适配与操作权限配置，详见[全栈扩展指南](../../docs/extending.md)。
5. 运行 `bun run check`；业务请求新增或修改时，再运行独立数据库集成测试与真实全栈测试。

`PageHeader` 是页面唯一的 `<h1>` 来源，不在页面另写 `<h1>`。模板语法树检查同时验证普通页面和共享列表的标题来源。

## 添加表格

当前业务资源使用 `ResourceListView` 和服务端分页，不对服务端返回的一页数据再次做本地分页。参考[表格](./tables.md)。

确需展示完整的内存数据集合时：

1. 用 `computed` 派生筛选结果 `matched`。
2. 使用 `paginate(matched.value, page.value, pageSize.value)` 派生分页信息。
3. 筛选和每页条数改变时回到第一页，删除后将页码收敛到有效范围。
4. 只渲染 `pageInfo.rows`，表格下方提供 `DataPagination`。
5. 区分“尚无数据”和“没有匹配结果”。

视图管理展示完整层级树，不使用平面分页。

## 添加表单

参考[表单](./forms.md)：使用 `FieldGroup`、`Field`、`FieldLabel`、控件及必要的 `FieldError`。校验逻辑放在 `src/lib/` 的纯函数中，首次提交时校验，之后实时反馈；通过 `aria-invalid` 表达错误，不手写错误颜色。

## 添加规则检查

参考[添加规则检查](./guards.md#添加规则检查)。新增检查后构造一个违反规则的临时文件，确认检查失败并指出文件，再清理临时文件，证明检查确实覆盖目标。

## 版本变更

仅补充或修正文档不修改 `package.json` 的版本号，也不单独发布版本标签。存在修复或功能代码变更时再更新版本号，文档提交独立记录。

## 提交前

先核对[项目约束](./constraints.md)及其自动检查范围。

- [ ] `bun run check` 通过：类型、格式、代码规则、单测、构建与浏览器测试。
- [ ] 新页面已配置组件、SysView、角色绑定和对应操作权限。
- [ ] 新纯逻辑有必要的相邻测试。
- [ ] 内部数据与回调类型明确，必要的未知边界经过验证。
- [ ] 没有硬编码颜色、`!important` 或 `outline: none`。
- [ ] 图标按钮提供 `aria-label` 和 `Tooltip`，新交互支持键盘。
- [ ] 可自动检查的新规则有有效检查，无法自动检查的部分明确交给审查。

## 常见问题

- **启用了 `erasableSyntaxOnly` 和 `noUnusedLocals`。** 未使用导入、枚举和参数属性会导致检查失败。
- **TypeScript 6 移除了 `baseUrl`。** `paths` 相对配置文件解析，不要重新添加 `baseUrl`。
- **shadcn-vue 读取根 `tsconfig.json` 的路径别名。** 根配置和 `tsconfig.app.json` 中的 `paths` 必须一致。
- **`vue-tsc -b` 使用增量缓存。** 怀疑缓存遮蔽错误时，可用 `gio trash node_modules/.tmp` 清理缓存后再检查。
- **Tailwind CSS v4 不使用 `tailwind.config.js`。** 主题定义在 `src/assets/main.css` 的 `@theme inline` 中。
- **按钮的手形光标需要统一恢复。** Tailwind CSS v4 的基础样式遵循浏览器默认光标；本项目在 `main.css` 的基础层恢复 `cursor: pointer`，不要逐组件修补。
- **未分层 CSS 的优先级高于分层工具类。** 新增未分层规则可能覆盖工具类；触摸输入框的 16px 规则正是利用这一点，无需 `!important`。
- **应用高度使用 `h-dvh`。** 移动 Safari 的 `vh` 可能包含浏览器工具栏遮挡区。
- **滚动容器使用 `min-h-0`。** 否则弹性布局子项不收缩，导致整个页面滚动。
- **宽内容的弹性布局子项使用 `min-w-0`。** 默认 `min-width: auto` 可能造成页面横向溢出。
- **`parseDate` 会对非法日期抛异常。** 例如 `2026-02-31` 和非闰年的 `2026-02-29`；日期校验需捕获异常，当前资源没有日期筛选功能。
- **压缩产物可能只有一行。** `rg -c` 统计行数，统计出现次数时使用 `rg -o … | wc -l`。
- **数字输入的 `v-model` 可能返回 number。** 按 `string | number` 接收并归一化，再调用字符串方法，否则提交处理可能抛出 `amount.trim is not a function`。
- **`AlertDialogAction` 会自行关闭弹窗。** 它可能在点击处理前清空目标状态；异步删除使用普通 `Button`，成功后主动关闭。
- **没有真实根元素的组件不能自动承接 `class`。** 显式声明并合并 `class`，或用 `inheritAttrs: false` 将 `$attrs` 绑定到正确元素。
- **所有表单设置 `novalidate`。** 浏览器原生校验可能阻止触发提交事件；使用自己的校验显示原因，数字小数字段仍应声明正确的 `step`。
- **只进行本地 Git 操作，不推送。** 不丢弃未经确认的未提交修改。
