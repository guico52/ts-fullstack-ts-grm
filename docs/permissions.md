# 权限目录与授权

`backend/src/plugins/` 放置自定义 Elysia 插件。`auth.ts` 校验身份，`permission.ts` 校验操作权限，`permission-catalog.ts` 根据完整路由目录托管 `SysPermission`；业务接口仍放在 `modules/`。

## 默认无需配置

挂在 `permissionGuard()` 之后的业务接口自动进入目录，默认权限标识为 `HTTP_METHOD:路由模板`，例如 `GET:/reports/:id`。路径参数保留模板，不使用请求中的实际 ID；末尾斜线规范化。不同请求方法是不同权限。业务接口必须声明具体 HTTP 请求方法，不能使用 `all()`。

身份校验与操作权限独立：登录、健康检查、开发文档在守卫之前注册；我的资料和自助改密只使用登录守卫。不要通过权限豁免开放匿名访问。

## 只配置例外

模块需要声明例外时引入 `permissionOptions`：

```ts
import { Elysia } from "elysia";
import { permissionOptions } from "../../plugins/permission-catalog.ts";

export function reportModule() {
  return new Elysia({ prefix: "/reports" })
    .use(permissionOptions)
    .get("/", () => listReports()) // 自动生成 GET:/reports
    .get("/preferences", () => preferences(), { permission: false })
    .post("/export", () => exportReports(), { permission: "reports.export" });
}
```

`permission: false` 不生成或检查操作权限，但仍要求登录，也仍检查强制改密状态。固定字符串覆盖自动 code；code 必须是 1–255 位无空白字符串，路由最多 1024 位。

**若接口路由可能变化，在修改路由前将当前 code 显式固定。** 例如原接口的自动 code 是 `GET:/reports/:id`，新路由仍声明 `permission: "GET:/reports/:id"`，即可保留原权限 ID 和角色授权。应在同一次部署中固定 code 并改变路由，避免先生成新权限后再产生定位冲突。

项目通过 `permission-codes.ts` 的统一生成配置固定现有示例的 33 个业务权限标识。配置仅匹配已有接口的请求方法和路由模板；新接口自动回退，无需登记资源前缀或向初始化代码添加权限。已有列表和详情共享读取权限；显式共享 code 时，数据库保存一个代表接口，优先保留仍存在的绑定，否则选择排序后的第一个接口。普通自动生成的权限仍是一接口一记录。

## 数据库托管规则

角色关联绑定权限 `id`。权限只使用 `code`，不需要显示名称。`code` 唯一，`url + method` 联合唯一。

| 路由目录与数据库的关系           | 同步结果                                    |
| -------------------------------- | ------------------------------------------- |
| code 一致，接口变化              | 更新 url/method，保留 ID 和角色关联         |
| url + method 一致，code 变化     | 更新 code，保留 ID 和角色关联               |
| 两者均不匹配                     | 新建权限，旧记录标记 deprecated，不转移授权 |
| 接口消失或改为 permission: false | 标记 deprecated，保留记录和角色关联         |
| 废弃接口以原身份重新出现         | 恢复有效状态，保留 ID 和角色关联            |
| code 与接口分别指向不同记录      | 报错并回滚，需人工处理                      |

同步在事务中执行，使用事务协作锁串行化并发写入；请求映射在成功后发布。同步不修改角色授权，不自动删除记录，也不恢复管理员显式软删除的记录。废弃权限不进入 `/auth/me/access`，从而立即失去授权效果。删除记录仍占用其唯一标识，避免重启时重建并恢复授权。

权限目录的 code/url/method/deprecated 由后端配置决定。管理接口的手动编辑会在下一次同步时按后端目录重新定位或覆盖，脱离接口目录的新记录会被标记废弃；日常授权应编辑角色关系，接口身份应在源码中配置。

## 初始化与部署范围

正式入口先同步完整权限目录，再初始化视图、角色和管理员，成功后才监听；数据库、定位冲突或初始化失败会阻止启动。直接 `app.handle()` 的集成测试需先 `await app.decorator.permissionCatalog.start(app.routes)`。插件自身也通过 `onStart` 自动初始化；异步初始化未成功时请求不会放行。

此插件管理一个应用在一个数据库中的完整目录。多个实例必须使用相同路由目录；事务协作锁不能解决不同版本相互标记权限废弃的问题，因此不支持不同路由版本同时启动并同步，也不能把多个不同服务的目录混入同一张表。

首次创建管理员角色时授予当时全部有效权限，后续新增权限不会自动追加到已有角色。管理员在权限列表查看目录，再到角色管理配置授权。重复初始化不恢复撤销的授权。

实现使用 Elysia 宏定义类型安全的路由选项：[@see Elysia 宏](https://elysiajs.com/patterns/macro)。插件作用域与 `app.routes` 行为由本项目单测及真实数据库启动测试验证。
