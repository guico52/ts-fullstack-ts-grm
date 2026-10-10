# 表单

当前业务使用 `ResourceFormDialog`、资源配置和类型明确的请求适配器；以下 `orders`、`members` 是教学变量。

表单使用 `Field` 系列，不自行用 `Label`、`Input` 和间距容器拼出另一套结构。参考 `src/components/rbac/ResourceFormDialog.vue`，创建和编辑共用弹窗，字段由资源配置驱动。

## 字段结构

```vue
<FieldGroup> <!-- 字段之间 gap-7 -->
  <Field> <!-- 字段内部 gap-3 -->
    <FieldLabel for="email">工作邮箱</FieldLabel>
    <Input id="email" v-model="email" />
    <FieldDescription>仅用于发送邀请。</FieldDescription>
    <FieldError v-if="errors.email">{{ errors.email }}</FieldError>
  </Field>
</FieldGroup>
```

| 组件               | 职责                                   |
| ------------------ | -------------------------------------- |
| `FieldGroup`       | 不同字段之间保持 28px 间距             |
| `Field`            | 标签、控件和消息之间保持 12px 间距     |
| `FieldLabel`       | 通过 `for` 关联真实控件                |
| `FieldDescription` | 持续显示必要的用户提示，不承载实现说明 |
| `FieldError`       | 原位显示校验错误                       |

内部间距小于字段间距，才能区分字段归属，详见[两级间距原则](./principles.md#1-间距分两级)。提示内容遵循[界面说明边界](./principles.md#21-界面不展示实现说明)。

## 排列方向

```vue
<Field> <!-- 默认垂直排列 -->
<Field orientation="horizontal"> <!-- 标签位于控件旁 -->
<Field orientation="responsive"> <!-- 小屏垂直排列，从 @md 起水平排列 -->
```

短标签配合开关或紧凑选择器可以水平排列；长标签或占满行宽的控件使用垂直排列。

## 字段错误

```vue
<Field :data-invalid="!!errors.email || undefined">
  <FieldLabel for="email">工作邮箱</FieldLabel>
  <Input
    id="email"
    v-model="email"
    :aria-invalid="errors.email ? true : undefined"
    :aria-describedby="errors.email ? 'email-error' : undefined"
  />
  <FieldError v-if="errors.email" id="email-error">{{ errors.email }}</FieldError>
</Field>
```

三项都要保留：`aria-invalid` 驱动控件已有错误样式，`aria-describedby` 关联当前错误文本，`Field` 的 `data-invalid` 表达整个字段组的错误状态。

未出错时传 `undefined` 以省略属性；显式传入 `false` 会渲染 `aria-invalid="false"`，与缺失属性的选择器匹配行为不同。不在各表单手写红色边框。

## 校验时机

首次提交时校验，首次尝试后实时反馈：

```ts
const submitted = ref(false)
const errors = computed(() => {
  if (!submitted.value) return {} // 首次提交前不显示错误。
  return validate(draft.value)
})

function submit() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  // 继续提交。
}
```

避免用户刚开始输入就看到错误。客户端校验用于及时反馈，服务端仍需独立验证，不能只依赖前端。

## 表单级错误

非单字段错误显示在触发按钮附近，并提供 `role="alert"`：

```vue
<div class="mt-6 flex flex-col gap-3">
  <p v-if="failure" role="alert" class="text-sm text-destructive">{{ failure }}</p>
  <div class="flex items-center gap-2">
    <Button type="submit" :disabled="saving">保存</Button>
    <Button type="button" variant="ghost">取消</Button>
  </div>
</div>
```

普通表单主操作在前、取消在后，保持位置一致；删除确认遵循危险操作的单独规则。

## 弹窗表单

```vue
<Dialog :open="open" @update:open="(v) => emit('update:open', !!v)">
  <DialogContent class="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>新建订单</DialogTitle>
      <DialogDescription>添加一条订单。</DialogDescription>
    </DialogHeader>
    <form novalidate @submit.prevent="submit">
      <FieldGroup class="gap-5">…</FieldGroup>
      <DialogFooter>…</DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

普通表单可以使用 `sm:max-w-lg`，单个问题使用较窄的 `sm:max-w-sm`；项目资源弹窗统一从 `dialog-sizes.ts` 选择宽度。不要让输入框无必要地占满整个屏幕。

弹窗使用 `gap-5`。页脚在 `<form>` 内，确认按钮为 `type="submit"`，使回车可以提交。表单设置 `novalidate`，由自己的校验显示原因。

每次打开弹窗重新初始化草稿，不仅在挂载时初始化。创建和编辑共用组件，`null` 表示创建，避免两个组件的字段定义漂移。

### 长表单布局

字段配置控制分区、并排、可见性和自动值：

| 属性           | 效果                                       |
| -------------- | ------------------------------------------ |
| `legend`       | 开始一个分区，后续无分区标题的字段归入该组 |
| `span: 1`      | 宽弹窗中占半行，让两个短字段并排           |
| `clearable`    | 允许清空非必填选择字段                     |
| `visibleWhen`  | 当前类型不适用时隐藏字段                   |
| `requiredWhen` | 按类型决定必填，例如按钮必须有父页面       |
| `auto`         | 用户手动编辑前，根据其他字段派生默认值     |
| `picker`       | 多值选择使用平面或树形控件                 |
| `step`         | 数字控件步长，例如金额使用 `0.01`          |
| `derive`       | 选择后同步填充其他关联字段                 |

```ts
{ key: "type", label: "类型", kind: "select", span: 1,
  legend: "基本信息", options: VIEW_TYPES },
{ key: "sort", label: "排序", kind: "number", span: 1 },
{ key: "componentPath", kind: "component", legend: "组件与路由",
  required: true, visibleWhen: (v) => v.type === "VIEW", derive: /* 派生字段 */ },
```

视图表单按基本信息、组件与路由、显示与层级分区；优先显示类型、排序和组件等结构决策，再显示图标等外观配置。增加分区或并排字段只改配置，不重复改组件。

隐藏字段不等于禁用字段。`visibleWhen` 使其退出布局、跳过必填校验，并在更新时按约定清空；页面改成菜单后，不应保留失去意义的路由。菜单和按钮不注册路由，因此 `path`、`componentPath`、`componentName` 允许为空。

`ResourceSpec.narrowOptions` 限制父节点候选：页面只能选菜单，按钮只能选页面。后端仍验证层级，非法组合返回 `422 INVALID_HIERARCHY`；控件限制只是便利，不能代替服务端保证。

`auto` 在用户手动编辑前根据父节点计算下一个排序值；创建时的自动值不能覆盖编辑已有记录的排序。后端插入事务也计算默认排序，确保绕过表单或并发创建时仍使用正确默认值。

小数字段必须声明正确 `step`，例如价格使用 `0.01`。数字控件默认步长为 1，原生校验可能阻止提交事件；详见[提交反馈原则](./principles.md#19-阻止提交必须给出原因)。

枚举和引用使用 `Combobox`，而不是自由文本或不可搜索的原生下拉菜单。`NativeSelect` 只保留给内部需要它的基础组件，例如 `Calendar`。

多值关联使用 `kind: "links"`，默认 `picker: "multi"` 对应 `MultiSelect`，`picker: "tree"` 对应 `TreeSelect`。角色视图采用树选择，权限采用平面多选；选择结果仍按整体集合替换，内部写入机制不显示在表单中。详见[三种选择器](./components.md#三种选择器)。

并排布局默认使用 `xl`（768px），单列默认使用 `md`（512px），资源配置可以通过 `width` 覆盖。否则半行字段可能比原来的单列控件更窄。弹窗限制最大高度并允许内部滚动，确保居中后顶部字段仍可访问。

## 弹窗异步写入

写入期间用户仍可能操作界面，需要三个保障：

1. 禁止重复提交，并阻止 Escape、点击外部、取消和右上角关闭等退出路径。
2. 在首次 `await` 前快照目标 ID 与请求体，后续不读取可能已改变的草稿。
3. 用会话标识验证响应仍属于当前弹窗，避免旧响应关闭后来打开的另一条记录。

```ts
const editingId = props.order?.id ?? null
const payload: OrderDraft = { ...draft.value }
const session = submitSession
await orders.save(editingId, payload)
if (session !== submitSession) return // 旧会话不再更新当前界面。
emit("update:open", false)
```

```ts
let submitSession = 0
watch(
  () => props.open,
  (open) => {
    submitSession += 1 // 任何打开或关闭都会使旧提交失效。
    if (!open) return
    // 重新初始化草稿。
  },
)
```

快照确定写入对象，会话标识确定由哪个界面处理响应。禁用按钮与会话校验都要保留，即使以后调整取消行为，也不会让旧响应影响新界面。

## 日期字段

当前没有日期资源控件。扩展日期选择器时，表单模型优先使用 `YYYY-MM-DD` 字符串，例如 `"2026-09-14"`；不要为只有日期的值引入 `Date` 的时间和时区语义，以免跨时区后日期变化。

日期校验需捕获 `parseDate` 对非法日期抛出的异常。共享校验可基于 `src/lib/validation.ts` 的 `isEmail`、`isBlank` 等函数组合，资源字段校验使用 `validateResource`。

## 规则清单

1. `FieldGroup` 包含 `Field`，字段间与字段内使用不同间距。
2. `FieldLabel.for` 与控件 `id` 一致。
3. 占位符提供示例，不代替标签。
4. 用 `aria-invalid` 表达错误。
5. 首次提交时校验，之后实时反馈。
6. 表单级错误放在提交按钮附近，使用 `role="alert"`。
7. 表单设置 `novalidate`，避免原生校验阻止自己的处理。
8. 校验放在 `src/lib/` 的纯函数中并测试，返回错误映射，不依赖组件或 store。

## 弹窗间距

`FieldGroup` 默认 `gap-7`（28px），弹窗允许 `gap-5`（20px）。弹窗列宽更紧凑，但字段间距仍大于字段内部间距，含义不变。不要新增第三种间距，先调整布局。

## 实时错误优先使用 computed

错误是草稿的纯派生结果时，使用 `computed`：

```ts
const errors = computed<MemberErrors>(() =>
  submitted.value ? validateMember(draft.value, members.members) : {},
)
```

用 `watch` 写入另一份错误状态需要同步每个字段，浅监听还可能遗漏嵌套修改，造成错误不消失。确需结合提交快照等额外状态时可使用深监听，但应明确依赖，优先使用派生结果。
