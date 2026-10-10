# 组件

基础组件位于 `src/components/ui/`，优先来自 shadcn-vue 组件库。已有基础组件不自行重写；缺少组件时通过命令添加：

```bash
bunx shadcn-vue@latest add <name> --yes --overwrite
```

重新生成前检查本地修改，避免覆盖维护中的组件。

## 可用组件

| 分类     | 组件                                                                                       |
| -------- | ------------------------------------------------------------------------------------------ |
| 布局     | `Card` 及其标题、内容、页脚等子组件，`Separator`、`Sheet`、`Dialog`                        |
| 表单     | `Field` 系列、`Input`、`Textarea`、`Label`、`Select`、`Switch`、`Checkbox`、`NativeSelect` |
| 选择器   | `Combobox`、`MultiSelect`、`TreeSelect`                                                    |
| 操作     | `Button`、`DropdownMenu` 系列、`ToggleGroup`                                               |
| 反馈     | `Alert`、`AlertDialog`、`Skeleton`、`Badge`、`Tooltip`                                     |
| 数据     | `Table` 系列、`Calendar`、`Popover`                                                        |
| 项目组件 | `DataPagination`、`StatCard`、`ResourceListView`、资源表单和视图树                         |

## 项目组件与辅助模块

- `src/components/layout/`：页面和分区标题、侧栏、导航项、顶栏、主题与强调色开关。
- `src/components/data/`：展示组件，只接收属性并发出事件，不导入 store 或路由。`ResourceListView` 组合表格、表单、分页、删除确认和关联候选；资源页面配置数据与请求即可，详见[资源页面原则](./principles.md#17-资源页面组合数据配置与请求)。
- `src/components/rbac/`：`ResourceFormDialog` 共享创建和编辑表单，`ViewTreeTable` 展示视图层级，`IconPicker` 选择目录中的图标，`ResetPasswordDialog` 提供独立的重置密码流程。
- `src/lib/dialog-sizes.ts`：统一命名的弹窗宽度，避免到处覆盖 `sm:max-w-*`。
- `src/config/icons.ts`：精选图标目录。新增图标需要显式导入和登记，不使用 `import * as icons`，以免无法按需移除整个图标库。
- `src/lib/views-catalog.ts`：通过 `import.meta.glob` 在构建时发现页面文件，提供组件名和默认路由，不另外维护文件清单。
- `src/lib/view-tree.ts`：按父节点分组、同层排序，再展开为带深度的可见行。纯函数测试覆盖缺失父节点和环等边界。

### 视图树

菜单包含页面，页面包含按钮。`ViewTreeTable` 用缩进表达深度，只有存在子节点的行显示展开按钮。页面请求完整树，不提供平面分页；普通资源列表继续分页。

后端验证层级关系，非法组合返回 `422 INVALID_HIERARCHY`；表单缩小父节点候选，避免用户选择无效组合。

菜单行提供“添加页面”，页面行提供“添加按钮”，按钮行不提供添加入口。点击后自动填入父节点、类型和下一个排序值，不重复询问已有上下文。

图标和类型标签用颜色表达层级：菜单使用主色，页面使用 `chart-1`，按钮使用次要色。行悬停只改变背景，不改变不可点击的层级图标，避免将其误认为操作控件。

颜色类在 `src/lib/rbac.ts` 中由语义变量组合，例如 `bg-chart-1/10 text-chart-1`。文字只使用适合浅色卡片对比度的 `chart-1`、`chart-4`、`chart-5`；其他序列色不用于该处文字。

视图树操作图标继承按钮的语义色：添加使用 `chart-4`，编辑使用 `chart-1`，删除使用 `destructive`。悬停增加同色的低透明度背景。

### 自动填充字段

| 字段            | 控件                  | 自动写入                               |
| --------------- | --------------------- | -------------------------------------- |
| `icon`          | `IconPicker`          | 仅图标字段                             |
| `componentPath` | 页面目录的 `Combobox` | 同时派生 `componentName` 和默认 `path` |

派生规则在字段 `derive` 中声明，由表单应用。新增类似“选择一项、填充多个字段”的行为时无需重复改组件。

## 选择控件

| 数据                | 推荐控件                        | 使用考虑                                       |
| ------------------- | ------------------------------- | ---------------------------------------------- |
| 少量固定值          | 选择器                          | 避免单选按钮占据过多高度                       |
| 表单中的布尔值      | `Switch`                        | 明确表达开关状态                               |
| 立即应用的布尔值    | `Switch`                        | 明确处理中与失败状态，需要时实现乐观更新       |
| 两三个互斥模式      | `ToggleGroup`                   | 直接呈现选项，减少打开菜单的操作               |
| 自由文本            | `Input`                         | 不强行塞入带“其他”的选择器                     |
| 一个可搜索外键      | `Combobox`                      | 数据增多后仍可搜索                             |
| 多个外键            | `MultiSelect`                   | 避免复选框列表随数据量增长                     |
| 有层级意义的多个 ID | `TreeSelect`                    | 保留节点间关系                                 |
| 日期                | 按需扩展日期选择器              | 当前未提供业务日期控件，扩展时保证跨浏览器体验 |
| 删除确认            | `AlertDialog`                   | 防止点击外部意外关闭                           |
| 长表单              | 有明确宽度和内部滚动的 `Dialog` | 不无条件铺满屏幕                               |

## 三种选择器

三种控件共用相近的触发器、搜索框和选项行，分别位于 `components/ui/combobox/`、`components/ui/multi-select/`、`components/ui/tree-select/`。

`Combobox` 返回一个 ID；`MultiSelect` 返回 ID 数组，选择后不关闭弹层。保持独立组件可避免每个属性和事件都变成 `string | string[]`。

`TreeSelect` 和 `MultiSelect` 都返回 `string[]`，差别在展示结构。树选项包含 `parentId` 和 `sort`，通过缩进展示深度：

- 搜索命中节点时同时保留祖先，避免失去所属菜单。
- 只有分支提供展开箭头；点击箭头折叠，点击行选择。
- 多选结果显示已选项标签，而不是仅显示数量。

## 按钮

```vue
<Button>保存</Button>
<Button variant="outline">取消</Button>
<Button variant="ghost" size="sm">清除</Button>
<Button variant="destructive">删除</Button>
<Button size="icon-sm" aria-label="编辑"><Pencil class="size-4" /></Button>
```

样式选项为 `default`、`destructive`、`outline`、`secondary`、`ghost`、`link`。尺寸为 `xs`（`h-6`）、`sm`（`h-8`）、`default`（`h-9`）、`lg`（`h-10`）和不同的 `icon*` 尺寸。

`Input`、`SelectTrigger` 和 `Button` 默认高度均为 `h-9`，同一行保持一致。图标使用 `size-4`，无需再添加 `mr-2`。

图标继承按钮前景色，不给图标固定颜色。Lucide 使用 `currentColor` 绘制，能自然跟随悬停、禁用和填充状态：

```vue
<!-- 普通操作继承按钮颜色。实际使用时另提供提示和名称。 -->
<Button variant="ghost" size="icon-sm" aria-label="编辑">
  <Pencil class="size-4" />
</Button>

<!-- 普通列表删除在悬停时呈现警示色。 -->
<Button
  variant="ghost"
  size="icon-sm"
  aria-label="删除"
  class="hover:bg-destructive/10 hover:text-destructive"
>
  <Trash2 class="size-4" />
</Button>
```

检查比较图标静止颜色和当前 `--muted-foreground`，避免可操作图标看起来像禁用。

## 加载状态

```vue
<Button type="submit" :disabled="saving">
  <Loader2 v-if="saving" class="size-4 animate-spin" />
  {{ saving ? "保存中" : "保存修改" }}
</Button>
```

文字与图标同时变化，让用户知道点击已被接收；处理期间禁止重复操作，失败后提供恢复路径。

## 使用边界

- 不硬编码颜色，使用 `text-destructive`、`bg-muted`、`border-border` 等语义类。
- 不随意移除基础组件的焦点环，避免键盘用户无法判断焦点。
- 不重复实现组件库已有的基础控件。
- `components/data/` 不导入 store 或路由，由外部传入数据与能力。
- 不在 `Button` 内嵌套另一个可点击元素，次要操作放在适当的弹层内容中。
- 不为组件建立独立间距体系，沿用 `Field`、`FieldGroup` 与页面容器。

## 推荐组合

公司顶栏使用 `AppTopbar`，每页保留居中醒目的公司全称，品牌从配置读取，长名称在小屏换行并与控件分开。

指标卡使用 `StatCard`，标签沿用统一样式，数值使用 `tabular-nums`。图标操作使用 `Tooltip` 与 `aria-label`，参考 `ResourceListView.vue`。

弹窗表单按 `Dialog`、标题、`form`、`FieldGroup`、`DialogFooter` 组合，页脚位于表单内，参考 `ResourceFormDialog.vue`。

筛选栏可使用 `Card`、`CardContent` 和自动换行的带标签控件，清除按钮显示活动筛选组数量；当前通用资源列表按实际资源需求提供筛选。

## 公司与项目标识

修改 `src/config/brand.ts`：`companyName` 为顶栏公司全称，`defaultLogoImage` 为侧栏默认图片地址，`projectName` 为图片旁项目名，`projectFont` 控制字体、大小与字重，字号不低于 16px。

不添加英文副标题或额外标语。默认资源位于 `public/images/default-company-logo.svg`；配置只存图片地址，不存图形内容。更换彩色图片时检查并移除单色占位图所用的 `dark:invert`。浏览器标题也在 Vite 构建时读取同一品牌配置。
