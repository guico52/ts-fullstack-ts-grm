# 规则检查

只存在于文档中的规则容易失效。项目对可以自动判断的规则提供源码、语法树、渲染和浏览器检查；具体覆盖边界见[项目约束](./constraints.md)，不代表所有设计规则都已自动检查。

```bash
bun run test # 规则、纯逻辑和组件交互测试
```

检查失败时应指出违规文件，例如：

```text
AssertionError: expected [ 'views/BadView.vue' ] to deeply equal []
```

## 检查位置

| 文件                            | 检查层次                               |
| ------------------------------- | -------------------------------------- |
| `src/lib/design-system.test.ts` | 源码扫描、单文件组件语法树和服务端渲染 |
| `src/lib/*.test.ts`             | 纯逻辑                                 |
| `src/components/**/*.test.ts`   | 使用 happy-dom 的组件交互              |
| `eslint.config.js`              | 无键的 `v-for`、`v-html` 等模板问题    |
| `tests/browser/`                | 真实浏览器中的布局、交互和页面流程     |

设计规范检查在没有 DOM 的 Node 环境运行，读取文件和服务端渲染都不需要浏览器，便于快速执行。

## 三种检查技术

### 1. 源码扫描

读取 `.vue` 文件，用正则检查简单结构，例如页面是否导入 `PageHeader`：

```ts
const offenders = vueSources("views")
  .filter((v) => !/from ["']@\/components\/layout\/PageHeader\.vue["']/.test(v.text))
  .map((v) => v.path)
expect(offenders).toEqual([])
```

断言违规文件列表为空，不只断言数量；失败时直接显示文件名。

### 2. 单文件组件语法树

复杂模板使用 `@vue/compiler-sfc` 的解析结果，区分真实标签、注释和字符串：

```vue
<template>
  <!-- <h2>已注释的标题</h2> -->
  <p>{{ "<h2>字符串中的标题</h2>" }}</p>
  <CardTitle>真实组件</CardTitle>
</template>
```

正则容易将注释和字符串误判为元素，语法树只遍历真实节点，并区分组件与 DOM 标签。遍历回调使用解析器对应的节点类型，不用 `any` 或 `unknown` 代替。

### 3. 服务端渲染

`@vue/server-renderer` 的 `renderToString` 将组件渲染为 HTML，可检查源码扫描无法证明的属性关联：

```ts
const html = await renderToString(h(StatCard, { label: "总数", value: "12" }))
expect(html).toContain("tabular-nums")
```

例如检查 `aria-labelledby` 是否指向真实标题。

## 字号下限检查

检查从 `main.css` 读取字号尺度，再扫描源文件中的字号字面值，同时验证关键组件的字号层级：

```ts
for (const match of read("assets/main.css").matchAll(/--text-(\w+):\s*([\d.]+)rem/g)) {
  scale[match[1]!] = parseFloat(match[2]!) * 16
}
```

将 `--text-xs` 改回 12px 会导致检查失败，确保字号下限由统一配置决定。当前没有图表页面或绘图库主题检查；将来增加画布图表时还需独立检查绘制字体。

## 添加规则检查

先验证检查确实匹配了目标，再列出违规文件：

```ts
describe("页面遵守指定规则", () => {
  it("确实存在被检查的文件", () => {
    expect(vueSources("views").length).toBeGreaterThan(0)
  })

  it("没有违反规则的文件", () => {
    const offenders = vueSources("views")
      .filter((v) => /* 具体违规条件 */)
      .map((v) => v.path)
    expect(offenders).toEqual([])
  })
})
```

匹配不到文件时自动通过，会导致检查悄悄失去作用。新增检查后必须构造一个反例，确认它失败并指出文件，再清理临时文件：

```bash
cat > src/views/TempBad.vue <<'TEMP'
<template><Table><TableBody /></Table></template>
TEMP
bunx vitest run src/lib/design-system.test.ts # 应当失败。
gio trash src/views/TempBad.vue
```

## 常见问题

- `renderToString` 是异步函数，每次渲染断言都要 `await`。
- 插槽内容可能包含注释标记，匹配标题时允许中间存在标记，不断言完全相邻的字符串。
- 依赖注入上下文的组件需要相应提供者，例如含 `Tooltip` 的测试树要包裹 `TooltipProvider`。
- 弹窗内容通过传送机制进入 `document.body`，不要只在挂载包装器内查找。
- 测试取得的 store 和挂载组件树使用同一个 Pinia 实例，不能依赖两份初始数据碰巧相同。
- 压缩产物可能只有一行，统计出现次数使用 `rg -o … | wc -l`。

```ts
expect(html).toMatch(/<h2[^>]*>[\s\S]*?总览[\s\S]*?<\/h2>/)
mount({ render: () => h(TooltipProvider, null, { default: () => h(OrganizationsView) }) })
```

## 第四层：真实浏览器

`tests/browser/` 通过 Playwright 驱动真实浏览器，是验证布局的测试层：

```bash
bun run test:browser     # 构建、预览并运行 Chromium 检查。
bun run test:browser:run # 使用已有 dist/，适合只修改测试的迭代。
```

本地使用四个工作进程，设置持续集成环境时配置为两个；仓库本身不提供持续集成配置。每个测试使用独立浏览器上下文，隔离会话、存储与模拟接口状态。
@see [Playwright 浏览器上下文隔离](https://playwright.dev/docs/browser-contexts)

检查 DOM 或测量布局前使用 `tests/browser/helpers.ts` 的 `gotoPage`，等待路由标题、字体和渲染帧。不要使用 `networkidle` 代替界面就绪；它会额外等待网络静默，不能证明目标控件已经可用。
@see [Playwright 加载状态](https://playwright.dev/docs/api/class-page#page-wait-for-load-state)

悬停检查通过 `settleTransitions` 等待有限动画完成，再比较最终样式；固定延时可能测到过渡中间状态，也可能无必要地等待。

组件测试每例结束卸载包装器。只有需要推进模拟延迟的用例使用虚拟计时器，异步写入仍要等待；浏览器异步生命周期用例保留真实延迟，检查请求期间的控件状态。

### 横向溢出

检查遍历元素，报告右边缘越过视口的对象，并明确排除：

- 固定定位和传送浮层内容，如提示、菜单、通知和弹窗。
- 横向滚动容器内部允许超宽的内容；容器本身仍检查。
- 1px 辅助元素，如 `sr-only`，以及隐藏元素。

因此该检查主要验证页面内容，不能用它宣称所有浮层在任意位置都正确。

### 操作流程与反馈

`tests/browser/resource-list.spec.ts` 通过实际界面验证创建、编辑和删除。模拟接口的浏览器流程覆盖前端交互，真实后端流程单独位于 `tests/fullstack/`，配置见[测试指南](../../docs/testing.md)。

`tests/browser/interaction.spec.ts` 检查交互控件的计算光标与悬停样式，happy-dom 没有真实 CSS 布局和计算能力，不能替代这些检查。

光标规则位于 `main.css` 的基础层，新增组件自动继承；确有需要时仍可通过工具类覆盖。验证检查时可临时移除规则，确认测试报告具体失败，随后恢复，避免检查实际没有测量目标。

## 尚未自动覆盖的范围

- 任意硬编码颜色：当前拒绝部分黑白文字类，但没有完整的样式检查器阻止全部字面色。
- 每处字号是否符合语义层级：下限和关键组件受检查，所有调用位置仍需审查。
- 截图视觉回归：当前没有截图差异比较。
- 未包含在已有交互和流程测试中的组件行为。
- 页面纵向长度：页面允许向下滚动，主要溢出检查约束横轴。
- 每处 `unknown` 是否必要，以及外部数据验证是否充分：由类型约束和人工审查共同保证。

新增覆盖后同步维护本文件，避免宣称检查范围超出实际实现。
