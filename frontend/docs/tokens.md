# 主题变量

主题值集中在 `src/assets/main.css`，组件不自行定义一套颜色和尺寸。

- 不硬编码 `#2a78d6` 或 `bg-slate-100` 等颜色，表面和文字使用语义变量，以适配两种主题。
- 不为单个页面增加近似重复的变量；优先复用已有值，避免调色板失去一致性。

## 语义颜色

以下变量在 `:root`（浅色）与 `.dark` 中定义，并通过 `@theme inline` 映射为工具类：

| 变量                   | 工具类                       | 用途                 |
| ---------------------- | ---------------------------- | -------------------- |
| `--background`         | `bg-background`              | 页面背景             |
| `--foreground`         | `text-foreground`            | 默认文字             |
| `--card`               | `bg-card`                    | 卡片、表格和弹窗表面 |
| `--card-foreground`    | `text-card-foreground`       | 卡片文字             |
| `--popover`            | `bg-popover`                 | 菜单、浮层与日历表面 |
| `--primary`            | `bg-primary`、`text-primary` | 品牌强调色           |
| `--primary-foreground` | `text-primary-foreground`    | 强调色表面上的文字   |
| `--secondary`          | `bg-secondary`               | 次要控件填充         |
| `--muted`              | `bg-muted`                   | 非活动填充与代码背景 |
| `--muted-foreground`   | `text-muted-foreground`      | 提示、标签与附属信息 |
| `--accent`             | `bg-accent`                  | 菜单行悬停填充       |
| `--destructive`        | `text-destructive`           | 错误与删除操作       |
| `--border`             | `border-border`              | 细边框               |
| `--input`              | `border-input`               | 控件边框             |
| `--ring`               | `ring-ring`                  | 焦点环               |
| `--sidebar*`           | `bg-sidebar` 等              | 侧栏外壳             |

非主要内容的文字优先使用 `--muted-foreground`。深色模式的 `--border` 为 `oklch(1 0 0 / 8%)`，半透明边框能适应页面、卡片与浮层的不同背景。

## 品牌强调色

强调色由明度、色度和色相三个值决定：

```css
:root {
  --brand-l: 0.52;
  --brand-c: 0.115;
  --brand-h: 178;
  --primary: oklch(var(--brand-l) var(--brand-c) var(--brand-h));
}
```

其他状态从它们派生：

```css
--primary-glow: oklch(var(--brand-l) var(--brand-c) var(--brand-h) / 15%);
--accent: oklch(0.93 calc(var(--brand-c) * 0.2) var(--brand-h));
```

切换强调色时，通过 `<html>` 的 `data-accent` 属性覆盖三个变量：

```css
[data-accent="green"] {
  --brand-h: 155;
  --brand-c: 0.13;
  --brand-l: 0.5;
}
.dark[data-accent="green"] {
  --brand-l: 0.76;
  --brand-c: 0.17;
}
```

默认青绿色不在根元素设置属性，但仍保留相应 CSS 选择器，供颜色选择器的局部预览使用；否则预览会错误继承当前强调色。

### 添加强调色

同步修改三个位置：

1. `src/lib/accent.ts` 的 `ACCENTS` 和 `ACCENT_LABELS`。
2. `src/assets/main.css` 的浅色与深色定义。
3. `index.html` 防闪烁脚本中的允许值。

检查验证 CSS 和内联脚本一致性。`ACCENT_LABELS` 使用 `Record<Accent, string>`，遗漏标签会产生类型错误。

### 局部颜色预览

`--primary` 在根元素组合，局部覆盖品牌变量时，直接使用三个值绘制预览：

```vue
<span
  :data-accent="accent"
  style="background: oklch(var(--brand-l) var(--brand-c) var(--brand-h))"
/>
```

## 图表颜色

`--chart-1` 至 `--chart-5` 与品牌强调色独立，用户切换强调色不应改变图表序列颜色。

| 序号 | 浅色      | 深色      |
| ---- | --------- | --------- |
| 1    | `#2a78d6` | `#00a9a6` |
| 2    | `#1baf7a` | `#00a764` |
| 3    | `#eda100` | `#b58800` |
| 4    | `#008300` | `#9e64ee` |
| 5    | `#4a3aa7` | `#e9523f` |

按顺序使用，不循环复用。已有相邻色区分检查以顺序使用为前提，不保证任意跳选组合。

`--chart-3` 在白色卡片上的对比度低于 3:1。多序列图表必须提供图例或表格，不能只靠颜色传达信息。

当前没有图表页面。将来增加画布图表时，从文档的计算样式读取变量；绘图库通常不能直接解析 CSS `var()`，颜色、字体和主题变化需要显式处理。

## 字体与字号

正文使用 `--font-sans`，即 Inter Variable；技术值使用系统等宽字体 `font-mono`。

字号不低于 14px，关键文字从 16px 起：

```css
/* main.css 统一覆盖字号，所有 text-xs 继承此值。 */
--text-xs: 0.875rem; /* 14px */
```

| 工具类      | 用途                                       |
| ----------- | ------------------------------------------ |
| `text-2xl`  | 指标卡数值等重点数据                       |
| `text-xl`   | `PageHeader` 提供的页面主标题              |
| `text-lg`   | 较宽屏幕的顶栏公司名、弹窗标题             |
| `text-base` | 卡片与分区标签、品牌、导航、表头等关键文字 |
| `text-sm`   | 正文、单元格、控件文字与页面副标题         |
| `text-xs`   | 提示、附属信息、行操作，仍为 14px          |

检查拒绝 `text-[11px]` 等低于下限的字面值。

标题使用 `tracking-[-0.01em]`，卡片与分区标签使用 `tracking-[0.08em]`。新增字号或字距前先判断内容层级是否确实变化，不为装饰增加一套尺度。

## 圆角

```css
--radius: 0.625rem; /* 10px */
--radius-sm: calc(var(--radius) - 4px);
--radius-md: calc(var(--radius) - 2px);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) + 4px);
```

控件通常使用 `rounded-md`，表面使用 `rounded-xl`，从统一变量派生。

## 层次与阴影

```css
:root {
  --shadow-card: 0 1px 2px oklch(0.3 0.03 250 / 6%);
}
.dark {
  --shadow-card: 0 0 #0000;
}
```

卡片阴影统一，深色模式关闭阴影，通过细边框表达层次。

## 玻璃表面

浮层、固定标题和通知可复用 `surface-glass`：

```css
background: color-mix(in oklab, var(--background) 85%, transparent);
backdrop-filter: blur(8px);
border: 1px solid var(--border);
border-radius: var(--radius);
```

`color-mix` 跟随背景主题，浅色下为半透明白色，深色下为半透明深色，无需固定 `rgba`。

## 特殊取色规则

颜色预览的轮廓允许使用 `ring-black/10 dark:ring-white/15`。预览可能呈现任意强调色，针对应用表面调整的 `ring-border` 无法保证在所有饱和色上可见，因此这里允许黑白半透明轮廓。

危险色表面的文字使用 `text-destructive-foreground`，不使用 `text-white`，以便危险色定义调整后前景仍保持一致。这是语义变量的正常使用。

## 动画

| 类名                                           | 用途                                        |
| ---------------------------------------------- | ------------------------------------------- |
| `transition-colors duration-200`               | 悬停和导航状态变化                          |
| `transition-all duration-200`                  | 侧栏宽度变化                                |
| `animate-in fade-in-0 zoom-in-95 duration-500` | 进入动画，配合 `motion-reduce:animate-none` |
| `animate-spin`                                 | 仅用于加载指示                              |

悬停过渡通常不超过 200ms，运动尊重 `prefers-reduced-motion`。

## 滚动条

滚动条在 `main.css` 定义并跟随主题：

```css
::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--muted-foreground) 38%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box; /* 10px 轨道、6px 滑块，保留可拖动区域。 */
}
@supports not selector(::-webkit-scrollbar) {
  * {
    scrollbar-width: thin;
  } /* 适用于不支持该伪元素的浏览器，例如 Firefox。 */
}
```

颜色表达式在滚动元素处计算，不提前提取到另一处组合变量，避免局部主题覆盖失效。
