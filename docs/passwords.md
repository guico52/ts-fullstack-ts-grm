# 密码管理

## 首次 Seed

Seed 创建默认数据后，仅在没有 initial_admin 持久标记时创建管理员，并在同一事务中完成首次角色绑定。
初始邮箱和密码来自 ADMIN_EMAIL / ADMIN_PWD，没有内置生产密码。之后修改环境变量不会覆盖密码。
标记查询包含软删除记录：改名、软删除、撤销管理员角色均不会重新创建或恢复。
账号彻底删除属于显式数据库维护，会移除标记；应用的删除接口始终使用软删除。

## 自己修改密码

所有登录用户通过顶栏入口访问 /account/password，该页面不依赖角色分配。
POST /auth/me/password 接收 `{ currentPassword, newPassword }`，身份从当前凭据取得。
当前密码错误、新旧相同返回 422 / INVALID_PASSWORD；新密码长度为 6–128 字符，空格原样保留。
更新密码、递增 tokenVersion、清除 mustChangePassword 在一条原子 UPDATE 中完成；并发修改使用版本比较避免覆盖新的重置结果。
成功后所有旧 JWT 失效，前端清除本地会话并返回登录页。

@see [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature)

## 管理员重置他人密码

用户列表中的重置入口需要独立权限 rbac.user.resetPassword。POST /rbac/users/:id/password 接收 `{ newPassword }`。
普通用户资料 PATCH 不接受 password，拥有 rbac.user.update 无法绕过重置权限。
重置会递增 tokenVersion 并设置 mustChangePassword=true，日志仅记录事件、操作者与目标用户 ID，不记录密码或哈希。
用户使用临时密码登录后必须先改密；业务接口返回 403 / PASSWORD_CHANGE_REQUIRED。
认证后的 /auth/me、/auth/me/access 与 /auth/me/password 仍可访问，以构建改密页面并完成验证。

## JWT 与升级

受保护请求同时验证签名、过期时间、用户未软删除及 tokenVersion 一致。前端遇到 401 清除会话和动态路由，要求重新登录。
本地退出仍仅删除浏览器凭据，不单独撤销其他客户端；改密和重置会撤销该用户全部旧凭据。

@see [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#renew-the-session-id-after-any-privilege-level-change)

升级先执行 bun run db:deploy。迁移为现有用户添加 token_version、must_change_password、initial_admin；已有密码哈希保持原样。
已有 name=admin 的第一条记录被标记为初始管理员，不恢复其角色。若升级前已改名，迁移后、启动前应由维护人员按准确用户 ID 将该记录的 initial_admin 设为 true，避免再次初始化。旧 JWT 缺少版本声明，因此升级后需重新登录。
新 seed 共 33 个权限；一次性迁移会为仍持有 rbac.user.update 的原有「管理员」角色补齐重置权限；其他角色需显式授予。后续 seed 不恢复撤销的权限或成员绑定。
若初始管理员已撤权或软删除，请由仍持有授权的管理员处理；不要把修改环境变量或重启作为账户恢复方式。

## 验证

集成测试覆盖旧密码错误、跨用户重置拒绝、普通 PATCH 绕过拒绝、全会话撤销、强制改密、软删除失效和 seed 不恢复账号。
真实浏览器测试覆盖用户改密、管理员重置、强制改密跳转、旧会话自动退出与窄屏布局。

## 我的信息

顶栏“我的信息”进入 /account/profile，所有登录用户均可访问，不需要系统管理权限。
GET /auth/me 从当前身份查询姓名、邮箱、组织、角色与改密状态，不接受目标用户 ID，不返回密码哈希、token 或 tokenVersion。
组织或角色被软删除时，页面显示未关联组织或未分配角色；页面重新加载会读取数据库最新资料。
页面提供修改密码入口；用户管理页重新读取当前权限，使升级后新增的重置入口无需重新登录即可显示。
