# 自定义插件

跨领域的自定义 Elysia 插件放在此目录，由 `src/app.ts` 组装。业务 controller 继续放在 `src/modules/`，第三方插件由 `http.ts` 包装配置。

| 文件 | 职责 |
| --- | --- |
| `http.ts` | CORS 与开发 Swagger 文档 |
| `errors.ts` | 全局错误响应 |
| `jwt.ts`、`jwt-secret.ts` | JWT 签发与校验配置 |
| `auth.ts` | 登录与会话有效性检查 |
| `permission.ts` | 每次请求的操作权限检查 |
| `permission-catalog.ts` | 路由选项、权限生成和目录同步 |
| `permission-codes.ts` | 当前示例的固定 code 生成配置 |

参见[权限说明](../../../docs/permissions.md)与[后端约束](../../docs/constraints.md)。
