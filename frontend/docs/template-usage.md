# 从全栈模板初始化项目

使用当前 ts-fullstack-ts-grm 仓库的已发布 tag 或明确 commit，导出 frontend、backend、scripts、docs 和根锁文件。不要仅复制 frontend，也不需要访问私有 vue-admin-template 上游。
源码来源和导出 commit 保留在 [template-origin.md](./template-origin.md)，其私有地址仅作来源记录。

```bash
# 在当前模板 checkout 执行，目标目录必须不存在。
set -e
project_dir="$PWD/../my-fullstack"
template_commit="$(git rev-parse --verify 'HEAD^{commit}')"
template_archive="$(mktemp --suffix=.tar)"
git archive --format=tar --output="$template_archive" "$template_commit"
mkdir "$project_dir"
tar -xf "$template_archive" -C "$project_dir"
cd "$project_dir"
git init -b main
printf '# 模板来源

- ts-fullstack-ts-grm commit: %s
' "$template_commit" > docs/project-origin.md
bun install --frozen-lockfile
```

只导出已提交内容，工作区修复应先提交后再导出。确认后可用 gio trash 清理临时 archive。
@see https://git-scm.com/docs/git-archive

## 定制清单

1. 同时修改根及两端 package.json 的名称，同步 workspace 依赖、脚本 filter 和 api.ts 的类型导入；重新 bun install 更新锁文件。
2. 修改 frontend/src/config/brand.ts，替换 public/images/ 中的 Logo，同步浏览器品牌断言。
3. 按根 README 配置 PostgreSQL、迁移与管理员凭据；frontend/.env 中配置 VITE_API_URL。
4. 默认业务为图书、作者、书店；按[扩展指南](../../docs/extending.md)增加或删除整个业务链路。
5. 保留 LICENSE 与 NOTICE，更新 README 与项目来源说明。
6. 安装 Chromium 后运行根 bun run check，再在独立数据库运行集成与真实全栈测试。

完整流程通过后检查 git diff，创建新项目自己的初始化提交。模板更新不会自动同步：比较来源 commit 和新版本，按需迁移并重新验证。
代码变更更新版本；纯文档修正不要求发布新版本。仓库内 private: true 防止误发 npm，不限制使用源码创建项目。
