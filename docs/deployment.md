# 部署与运维

当前是示例模板。生产部署前需要确定数据库备份、TLS、访问控制和监控策略。

## 构建与运行

安装 Bun 1.3.14 和 Node.js ≥24.11.0。在目标环境执行 bun install --frozen-lockfile。
配置 PG_*、NODE_ENV=production、强随机 JWT_SECRET、CORS_ORIGINS、PORT。管理员初始化需要 ADMIN_EMAIL / ADMIN_PWD；持久初始化标记存在时不会覆盖凭据或恢复绑定。
先以迁移账号运行 bun run db:deploy，再在 backend/ 内 bun run start。后端直接运行 TypeScript，不需要额外构建。

前端在构建时注入地址：

```bash
VITE_API_URL=https://api.example.com bun run build
```

将 frontend/dist 部署到静态服务器。Vue Router 使用历史路由模式，需要将非静态文件路径回退到 index.html；否则刷新 /system/users 会由 Web 服务器返回 404。
跨域模式将前端真实来源加入 CORS_ORIGINS。若使用同域反向代理，VITE_API_URL 使用含协议与域名的 API 基础地址。
Vite 环境变量写入浏览器产物，不存放密码或签名密钥。

## 初始化与健康

权限目录同步与初始化在监听之前完成；同步或初始化失败会阻止启动。检查迁移、初始化日志及管理员登录。目录同步使用完整快照，多实例必须运行同一路由版本，见[权限说明](./permissions.md)。
/health 只确认进程存活，/health/db 查询真实业务表；后者成功也不证明默认数据已初始化。
默认 11 个视图、33 个权限点和两个角色。初始化幂等且不覆盖已有角色绑定，新权限需显式授予。
SIGINT / SIGTERM 会停止 HTTP 服务并关闭 pg 连接池。迁移前备份数据库，生产不运行 db:push。

## 认证边界

生产环境缺失 JWT_SECRET 时启动失败。默认管理员口令和开发 JWT 密钥仅供本地示例，部署时由密钥管理系统注入。
JWT 有效期 7 天，保存在浏览器 localStorage；前端退出不撤销已复制的登录凭据。业务请求每次读取当前角色权限。
当前没有登录限流、独立会话撤销接口、多租户隔离和完整审计日志；需要这些能力的应用应在网关及业务层实现后再上线。
Swagger 默认在生产关闭；显式 ENABLE_DOCS=true 会开启，请控制其访问。

## 许可证与来源

源码按 Apache-2.0 发布，保留根 LICENSE / NOTICE。上游导出记录见 frontend/docs/template-origin.md。
第三方依赖保持各自许可证；发布前核查新增依赖与复制代码的归属要求。

升级前执行 `bun run db:deploy`，本次迁移后旧 JWT 失效，用户需重新登录。本次迁移会为仍有用户更新权限的原有「管理员」角色补齐 `rbac.user.resetPassword`，其他角色需显式授予；不要通过重启恢复管理员权限。见[密码管理](./passwords.md)。
