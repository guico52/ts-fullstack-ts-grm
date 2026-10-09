# 项目约束总表

本文件汇总当前项目的开发、视觉、交互和交付约束。新增页面、修改组件或调整配置前先读本文件，再按链接查阅细节。规则以当前 `AGENTS.md`、实现和测试为依据；“已自动检查”只表示下文列出的覆盖范围，不代表所有违规形式都能被检测。

## 1. 技术栈和代码边界

- 使用 Vue 3、TypeScript、Vite、Tailwind v4、Pinia、Vue Router、shadcn-vue / Reka UI；测试使用 Vitest / Playwright。
- `views/` 组合页面；功能组件放在 `components/<feature>/`；状态和异步编排放在 `stores/`；过滤、排序、校验、格式化、分页等纯逻辑放在 `lib/`，测试与纯模块相邻。
- `lib/` 不依赖 Vue、Pinia 或组件；可以依赖纯第三方库。不要在 `.vue` 中堆积带条件的循环或业务算法。
- `components/data/` 只接收 props、发出事件，不导入 store 或 router。`PageHeader`、`SectionHeader` 同样保持展示职责；侧栏和主题开关可以使用状态。
- 基础组件来自 shadcn-vue registry；缺少 primitive 时通过 CLI 添加，不自行重写。优先通过 props、class 和封装扩展；直接修改 `components/ui/` 属于维护本地 fork，重新生成前检查修改，避免覆盖。
- 路由使用 lazy import，并设置 `meta.title`。新增业务组件在 SysView 中登记并绑定角色；路由和导航由可达集合自动派生。
- 组件使用 PascalCase，页面使用 `<Name>View.vue`，store 使用 `use<Name>Store`；纯模块优先 named exports，测试使用 `<unit>.test.ts`。
- TypeScript 严格检查、`noUnusedLocals` 和 `erasableSyntaxOnly` 保持启用。不要重新引入 `baseUrl`；`@` alias 的 paths 在根配置和应用配置中保持一致。

详见 [architecture.md](./architecture.md)、[workflow.md](./workflow.md)。

## 2. 公司身份和项目品牌

- 每个页面通过应用 shell 保留 `AppTopbar`，居中、醒目地显示正规的公司全称，不能用项目名替代公司名。
- Topbar 不添加英文副标题；长公司名在小屏换行，不与操作按钮重叠，也不产生页面横向溢出。装饰使用现有语义 token。
- 菜单栏上方左侧显示公司 Logo 图片占位，右侧显示项目名；移除“运营控制台”等额外标语。折叠侧栏保留 Logo。
- 当前配置集中在 `src/config/brand.ts`：

| 字段               | 用途                                      | 当前默认值                         |
| ------------------ | ----------------------------------------- | ---------------------------------- |
| `companyName`      | Topbar 公司全称                           | 安徽泉象科技实业发展有限公司       |
| `defaultLogoImage` | 默认图片 URL；config 不包含 Logo 图形内容 | `/images/default-company-logo.svg` |
| `projectName`      | Logo 右侧项目名                           | 管理端模板                         |
| `projectFont`      | 项目名字体 family、size、weight           | `var(--font-sans)`、`1rem`、`650`  |

- 默认图片文件在 `public/images/default-company-logo.svg`。替换为彩色公司 Logo 时检查组件中的 `dark:invert`，该处理仅适用于当前单色占位图。
- 项目名不能低于 16px。浏览器标题由 Vite 读取同一配置，格式为“项目名 · 公司名称”；配置变动后重新构建并核对浏览器测试中的品牌断言。

详见 [components.md](./components.md#company-and-project-identity)。

## 3. 视觉系统和布局

- UI 颜色通过 `src/assets/main.css` 中的语义 token 提供；不要在组件或图表 option 中硬编码颜色。主题取色控件的已批准例外见 [tokens.md](./tokens.md#the-two-sanctioned-exceptions)。
- 每个 accent 都有 light / dark 定义，默认 accent 也必须有；新增 accent 同步维护 accent 列表、CSS 和 `index.html` 的 anti-flash 脚本。
- anti-flash 脚本与主题 store 使用相同 storage key；缺失主题配置时默认 dark。未知配置安全回退，不能导致启动异常。
- 字号下限 14px；页面标题、品牌、卡片标题、导航、表头等关键文字从 16px 起。`text-xs` 在 CSS 中统一覆盖为 14px，不通过逐组件修补实现。
- 每个 view 使用 `PageHeader`，不得另写 `<h1>`；分区标题使用 `SectionHeader` 的 `<h2>`。
- 数据卡片标题统一使用：

```text
text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase
```

- 普通页面为 `p-4 space-y-4`；dashboard 为 `p-4 md:p-6 space-y-6`。
- 表单字段内部 `gap-3`、字段之间 `gap-7`；dialog 内字段之间允许 `gap-5`。
- 数字使用 `tabular-nums`；ID、引用编号、IP、邮箱等技术值使用 `font-mono`。表格数字右对齐。
- radius 和 card shadow 复用统一 token；dark 模式通过 hairline / border 表达层次，关闭 card shadow。
- 页面在任何宽度都不能横向溢出。宽表可以在自己的滚动容器中横向滚动，容器本身不能越过视口。
- 宽内容的 flex item 使用 `min-w-0`；需要收缩的滚动区域使用 `min-h-0`；应用高度使用 `h-dvh`。
- 不用 `!important`、`outline: none` 绕过视觉系统或焦点反馈。新增动画尊重 `prefers-reduced-motion`；hover 使用短过渡，spinner 只用于 loading。

详见 [principles.md](./principles.md)、[tokens.md](./tokens.md)。

## 4. 导航、控件和可访问性

- **Menu 只展开 / 折叠，View 只导航。** 点击 Menu 不改变 URL。
- 新 Menu 默认展开；持久化关闭集合，访问关闭 Menu 下的页面时自动展开父级。
- GET /auth/me/access 是侧栏和业务路由的唯一数据源，access.ts 转为导航树；桌面侧栏和移动 drawer 共用内容。移动 drawer 的打开状态不持久化。
- icon-only 按钮同时提供 `aria-label` 和 `Tooltip`；测试树需要 `TooltipProvider`。
- 可交互且未 disabled 的控件必须显示 pointer cursor，并有可见 hover 反馈；pointer 在 `main.css` base layer 统一恢复，不逐个加 class。
- Lucide 图标继承按钮的 `currentColor`，不要将可操作图标固定为 `text-muted-foreground`。删除动作的警示色放在 hover；disabled 与 placeholder 按各自状态处理。
- label 通过 `for` 指向真实控件；操作支持键盘和焦点反馈。表格操作列提供 `sr-only` 标题。

详见 [navigation.md](./navigation.md)、[components.md](./components.md)。

## 5. 表单和异步写入

- 使用 `FieldGroup` / `Field` / `FieldLabel` / `FieldDescription` / `FieldError`；placeholder 是输入示例，不能代替 label。
- 首次 submit 时校验，首次尝试后实时反馈；校验逻辑是 `lib/` 纯函数。接入后端后，服务端仍需校验，不能仅依赖客户端。
- 错误样式由 `aria-invalid` 驱动；用 `aria-describedby` 关联当前提示，用 `Field` 的 `data-invalid` 表达字段组错误。不要自行添加红色边框。
- 不适用的条件字段隐藏；不通过 disabled 字段堆积无关信息。
- 非字段错误展示在触发操作附近，并提供 `role="alert"`。
- dialog form 的 footer 位于 `<form>` 内，确认按钮为 `type="submit"`；create / edit 复用表单，打开时重新初始化草稿。
- 所有异步写入都 `await`，提供 pending / disabled / failure 状态；不能将未完成操作显示为成功。
- 保存期间阻止重复提交及 Escape、outside click、Cancel、close 等退出路径；首次 `await` 前快照目标与 payload，并用会话标识阻止旧响应关闭新的 dialog。
- 删除确认使用 `AlertDialog`；需要异步处理时使用普通 `Button`，成功后主动关闭。`AlertDialogAction` 会在 click handler 前关闭 dialog，不用于依赖待删除目标状态的写入。
- `<input type="number">` 的 `v-model` 可能返回 number；字段按 `string | number` 接收并规范化，再调用字符串方法。
- 非法日历日期可能令 `parseDate` 抛错，日期校验要捕获异常。

详见 [forms.md](./forms.md)、[workflow.md](./workflow.md#traps)。

## 6. 表格、分页和过滤

- 每个数据表提供 `DataPagination`，不因数据少而省略分页。
- 通过 `src/lib/pagination.ts` 的 `paginate()` 派生 rows / pageCount / range；view 不自行用 `.slice()` 分页。
- page size 使用共享常量和 `PageSize`，当前选项为 `10 | 25 | 50 | 100`，不另造未被 selector 支持的数值。
- filter 或 page size 变更时回到第一页；删除导致页码越界时 clamp 到有效页。
- 空数据和过滤后无结果提供不同提示与出口：创建数据 / 清除过滤。
- 过滤状态整体传递和重置；清除按钮计数按过滤组计算，日期范围算一组。日期范围两端均包含。
- 内存过滤不添加 debounce；只有驱动请求时再评估。低优先级列可以响应式隐藏。

详见 [tables.md](./tables.md)。

## 7. 图表

本模板当前不包含图表页面。需要时再引入 ECharts，并沿用语义 token 的色板与 14px 字号下限：
色值不写死，信息不只靠颜色传达。

## 8. SSR、持久化和测试效率

- 模块加载和组件 setup 中不直接访问 `window` / `document`；DOM 操作放在浏览器生命周期或事件处理中。设计守卫会进行 SSR。
- storage 访问通过 `src/lib/storage.ts`，读写失败时保持当前会话可用。只持久化应跨 reload 保留的偏好；当前 demo 业务数据不持久化。
- 纯规则 / source guards 在 node 运行；仅交互测试使用 happy-dom。布局、computed style 和真实浏览器流程交给 Playwright。
- 组件测试每例结束卸载 wrapper；Dialog 内容在 `document.body` 断言；测试 store 与组件使用同一 Pinia。
- Playwright 用独立 browser context 隔离测试；本地 4 workers、CI 2 workers，保持用例独立，不依赖执行顺序。
- 导航使用 `tests/browser/helpers.ts` 的 `gotoPage` 等待 heading、fonts 和渲染帧；避免 `networkidle` 和固定 sleep。过渡使用 `settleTransitions` 等待有限动画。
- fake timers 仅用于需要推进 demo 延迟的用例，仍需 await 写入；浏览器异步生命周期用例保留真实延迟。
- `test:browser:run` 使用现有 `dist/`，只适合构建未改变的迭代；应用源码改变后先重新构建。preview 不复用遗留服务，避免测到旧产物。

详见 [guards.md](./guards.md)、[workflow.md](./workflow.md)。

## 9. 检查范围和交付要求

| 约束                                         | 当前自动检查                                                    | 仍需人工审查                                    |
| -------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| PageHeader、卡片标题、分页、展示组件依赖     | `src/lib/design-system.test.ts` 的 source / AST / SSR checks    | 实际组合语义、动态写法及扫描范围之外的违规      |
| 字号、accent、主题启动一致性                 | design-system guards                                            | 最终视觉层级、所有运行时样式                    |
| 颜色                                         | 禁止源码中的 `text-white` / `text-black`，部分 token 结构有守卫 | 其他硬编码颜色；当前没有通用 stylelint          |
| 导航和公司品牌                               | `tests/browser/navigation.spec.ts`                              | 品牌审美、真实企业 Logo；修改默认配置时同步断言 |
| 横向溢出、hover / cursor、label、表单和 CRUD | `tests/browser/` 当前路由 / 场景覆盖                            | 新路由加入覆盖；未覆盖状态、截图视觉回归        |
| 纯逻辑和组件行为                             | 相邻 Vitest 测试                                                | 未覆盖分支；服务器校验与集成行为                |
| 文档                                         | 相对 Markdown 链接、标题锚点、所引用源码路径守卫                | 文档描述是否仍与实现一致                        |

- 仅补充或修正文档时，不修改 `package.json` 的版本号，也不为这类变更单独发布版本 tag；存在 `fix`、`feat` 等代码变更时再更新版本号。
- 完成前执行 `bun run check`：typecheck → format / lint → unit tests → build → browser tests。它只 typecheck / build 一次。
- 任何布局、宽度或表单变更必须通过真实浏览器测试，不能用 happy-dom 测量代替。
- 新规则应尽可能添加有效守卫，并先验证守卫能捕获违反规则的案例；无法自动检查的规则明确留给 review。
- 引用实现来源、外部依据时保留 `@see`；Markdown 使用可追踪链接。ADR 替代关系双向记录。
- 不丢弃未经确认的未提交修改，不执行 `git reset --hard`、`git clean -f`、`git restore`、`git stash`；删除文件优先 `gio trash`。
- 未发布服务默认不维护无用兼容层；确认无外部使用方后直接删除未使用代码。
- 只做本地 Git 操作，不 push。依赖、构建产物、测试报告和本地工具缓存不提交。

当前脚手架未实现真实 auth、API、i18n 和服务端分页；以上对接要求不表示这些能力已经存在。新增后维护本表、专题文档及检查范围，避免约定与实现漂移。
