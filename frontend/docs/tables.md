# 表格

当前业务列表使用 `ResourceListView` 和服务端 `limit`、`offset` 分页，参考 `src/views/system/OrganizationsView.vue`。示例中的 `orders`、`matched` 是本地集合的教学变量，不代表已有订单模块。

平面表格都提供 `DataPagination`，源码检查验证这一点；视图管理展示完整层级树，不使用平面分页。

## 基本结构

```vue
<Card>
  <CardHeader>
    <CardTitle class="text-base font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      查询结果
    </CardTitle>
    <CardDescription>共 {{ orders.total }} 条订单</CardDescription>
  </CardHeader>
  <CardContent class="px-0">
    <Table>
      <TableHeader>…</TableHeader>
      <TableBody>
        <TableRow v-for="row in pageInfo.rows" :key="row.id">…</TableRow>
      </TableBody>
    </Table>
    <div v-if="matched.length === 0">…</div>
    <DataPagination v-else … />
  </CardContent>
</Card>
```

计数明确说明含义，区分筛选匹配数、总数和当前页条数。`CardContent` 使用 `px-0`，表格与分页各自提供所需间距。

## 列规范

```vue
<TableHead>编号</TableHead>
<TableHead class="text-right">金额</TableHead>
<TableHead class="hidden md:table-cell">邮箱</TableHead>
<TableHead class="w-20"><span class="sr-only">操作</span></TableHead>
```

数字右对齐并使用 `tabular-nums`，技术值使用 `font-mono`。小屏优先隐藏次要列，而不是压缩全部列。操作列表头使用 `sr-only`，图标操作同时提供 `aria-label` 和 `Tooltip`。

## 分页

服务端分页由 `src/composables/useResource.ts` 管理请求和状态，并使用共享分页信息。不对服务端的一页结果再次做本地分页。

完整的内存集合使用 `src/lib/pagination.ts`：

```ts
const page = ref(1)
const pageSize = ref<PageSize>(DEFAULT_PAGE_SIZE)
const pageInfo = computed(() => paginate(matched.value, page.value, pageSize.value))

watch(filters, () => {
  page.value = 1
})
watch(pageSize, () => {
  page.value = 1
})

// 删除最后一页最后一行后，调整到有效页码。
watch(
  () => pageInfo.value.page,
  (safe) => {
    if (safe !== page.value) page.value = safe
  },
)
```

```vue
<DataPagination
  :page="pageInfo.page"
  :page-size="pageInfo.pageSize"
  :page-count="pageInfo.pageCount"
  :total="pageInfo.total"
  :from="pageInfo.from"
  :to="pageInfo.to"
  @update:page="page = $event"
  @update:page-size="pageSize = $event"
/>
```

不要在页面自行调用 `rows.slice((page - 1) * size, …)`。`paginate()` 会将页码收敛到有效范围，避免删除后仍停留在不存在的页。

`pagination.test.ts` 覆盖越界、空集合、`NaN` 页码和分页窗口不产生相邻省略号等情况。`PageSize` 为 `10 | 25 | 50 | 100`，控件与类型使用同一组值。

## 按数据选择筛选控件

| 数据                     | 控件                    | 原因                           |
| ------------------------ | ----------------------- | ------------------------------ |
| 用户不确定完整内容的文本 | `Input`，按需要搜索多列 | 不要求用户预先知道内容在哪一列 |
| 固定枚举                 | 选择器，提供“全部”      | 避免自由输入非法值             |
| 时间范围                 | 两个日期选择器          | 起止边界可以独立清除           |

日期筛选是扩展示例，当前资源没有日期筛选控件。增加时可使用 ISO 日期字符串比较，起止边界均包含在范围内。

清除按钮统计筛选组，不统计单独字段；日期范围算一组：

```ts
export function countActiveFilters(filters: OrderFilters): number {
  let count = 0
  if (filters.search.trim() !== "") count += 1
  if (filters.status !== "all") count += 1
  if (filters.from || filters.to) count += 1 // 日期范围是一组。
  return count
}
```

内存筛选不添加无必要的防抖；只有驱动网络请求时再评估。筛选状态作为一个完整对象传递和重置，避免部分更新遗留旧字段。

## 空状态

```vue
<p>{{ orders.total === 0 ? "还没有订单。" : "没有匹配筛选条件的订单。" }}</p>
<Button v-if="orders.total === 0" @click="openCreate">新建订单</Button>
<Button v-else variant="outline" @click="clearFilters">清除筛选</Button>
```

尚无数据时提供创建入口；筛选后无结果时提供清除筛选入口。

## 删除

使用 `AlertDialog`，避免普通弹窗被意外点击外部关闭。确认按钮使用明确文字，危险动作放在安全选择之后：

```vue
<Button variant="destructive" :disabled="deleting" @click="confirmDelete">
  删除订单
</Button>
```

`confirmDelete` 在首次等待前快照目标，等待写入成功后再关闭。异步流程不使用 `AlertDialogAction`，它会在处理函数读取状态前关闭弹窗。详见[弹窗异步写入](./forms.md#弹窗异步写入)。

## 逻辑放在哪里

```text
src/lib/resource.ts              资源校验、表单值和请求转换
src/lib/resource-api.ts          类型明确的创建与更新适配器
src/lib/pagination.ts            分页信息与窗口计算
src/composables/useResource.ts   服务端分页与请求状态
```

过滤、排序、校验和分页算法放在 `src/lib/` 的纯函数中并测试。页面负责状态连接与渲染，不在 `.vue` 中堆积带条件的循环。
