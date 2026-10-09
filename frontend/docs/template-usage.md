# 从模板初始化新项目

模板仓库：[vue-admin-template（私有 Gitea）](https://gitea.guico.top/guico/vue-admin-template.git)。

本项目作为业务项目的初始化起点。推荐从一个确定的 Git commit 或 tag 导出源码，再创建业务项目自己的 Git 仓库。模板历史留在模板仓库，业务历史从初始化提交开始。

## 1. 选择引用方式

| 方式                                             | 适用情况                                  | 注意事项                                                                |
| ------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------- |
| clone 模板，再用 `git archive` 导出并 `git init` | 默认方式：独立业务项目                    | 导出已提交版本，记录来源 commit；后续按需迁移更新                       |
| 直接 `git clone`，保留模板历史                   | 明确需要后续 merge / cherry-pick 模板更新 | 保留共同祖先，将模板 remote 命名为 `upstream`                           |
| `cp`                                             | 临时实验，或刻意复制未提交内容            | 容易混入 `.git`、`node_modules`、`dist`、本地状态；不作为正式初始化方式 |

`git archive` 输出指定 tree 的文件，不包含 `.git`，也不会带入未提交改动或未跟踪文件。已经提交到版本中的不必要文件仍会被导出，因此模板自身也要保持干净。

依据：[git-archive 官方说明](https://git-scm.com/docs/git-archive)、[git-clone 官方说明](https://git-scm.com/docs/git-clone)。

## 2. 私有仓库访问

操作前确认当前账号有仓库读取权限。HTTPS clone 使用 Gitea 实例支持的认证方式，例如凭据管理器保存的账号和 access token；不要将 token 写进 URL、项目文件或提交。

本文只需要读取模板仓库，不要求向模板仓库推送，也不依赖 Gitea 的模板按钮。初始化后仍遵守项目的本地 Git 操作约束，远端发布单独处理。

## 3. 推荐流程：导出源码，创建独立仓库

下面的命令从远端下载模板，再导出到当前目录下的新目录 `my-admin`。更换项目名时修改 `project_dir`；目标目录必须不存在，`mkdir` 会阻止覆盖已有项目。

`template_ref=HEAD` 表示本次 clone 得到的默认分支版本。正式项目优先填入已发布 tag 或已知 commit，例如 `template-v1.0.0`；这个 tag 名只是示例，不表示仓库已发布该版本。

```bash
# 在同一个 Bash 会话执行；任一步失败立即停止。
set -e

template_url="https://gitea.guico.top/guico/vue-admin-template.git"
template_ref="HEAD"
project_dir="$PWD/my-admin"
template_checkout="$(mktemp -d -t vue-admin-template.XXXXXX)"

git clone --single-branch "$template_url" "$template_checkout"
template_commit="$(git -C "$template_checkout" rev-parse --verify "${template_ref}^{commit}")"
git -C "$template_checkout" archive --format=tar \
  --output="$template_checkout/template.tar" "$template_commit"

mkdir "$project_dir"
tar -xf "$template_checkout/template.tar" -C "$project_dir"
cd "$project_dir"
git init -b main

# 记录模板来源，便于将来对比和迁移。
printf '# 模板来源\n\n- 仓库：%s\n- 引用：%s\n- Commit：%s\n' \
  "$template_url" "$template_ref" "$template_commit" > docs/template-origin.md

bun install --frozen-lockfile
```

此时得到的是独立的新仓库，还没有初始化提交。临时 clone 保留在 `$template_checkout`，确认导出无误后可用 `gio trash "$template_checkout"` 清理。

继续完成项目定制：

1. 修改 `package.json` 的 `name`；如果更改依赖，更新并提交 `bun.lock`。
2. 修改 `src/config/brand.ts` 的公司全称、项目名、默认图片 URL 和项目字体。
3. 替换默认 Logo 图片；彩色图片检查并移除不适用的 `dark:invert`。
4. 更新项目 README，保留 `docs/template-origin.md` 及约束文档。
5. 同步 `tests/browser/navigation.spec.ts` 中的品牌文字、页面标题和默认图片断言；修改断言的预期值，保留布局和图片加载检查。
6. 按业务需要调整 routes / nav / demo 页面；新增页面遵守 [constraints.md](./constraints.md)。

定制完成后再检查并创建业务项目的首个提交：

```bash
# 如尚未安装浏览器二进制，先执行一次。
bunx playwright install chromium
bun run check

git add .
git diff --cached --stat
git commit -m "chore: initialize project from admin template"
```

`git archive` 仅导出指定版本。模板中新增的文档或修复必须先提交；从上述 Gitea 地址 clone 时，还必须已经存在于远端。模板维护者发布新版本后，新项目才能引用到它。

## 4. 可选流程：保留模板历史

若业务项目明确需要持续合并模板修改，可以直接 clone，并把模板地址保留为 `upstream`：

```bash
git clone --single-branch \
  https://gitea.guico.top/guico/vue-admin-template.git my-admin
cd my-admin
git remote rename origin upstream
```

之后同样完成品牌和业务定制，运行 `bun run check`，再创建业务提交。这个仓库包含模板历史，不属于独立首提交模式。

业务仓库地址确定后，可自行添加该地址作为 `origin`；模板地址始终作为 `upstream`。本文不配置业务远端，也不执行 push。

后续更新先 `git fetch upstream --tags`，比较模板变化，再选择明确的提交进行 cherry-pick 或合并选定版本。业务页面和模板可能同时改变，不要将 `git pull` 当作无冲突的模板升级命令。

## 5. 模板版本和后续维护

- 仅补充或修正文档不修改版本号，也不单独发布版本 tag；存在 `fix`、`feat` 等代码变更时再更新 `package.json` 的版本号。
- 模板维护者在检查通过的代码版本提交上发布版本 tag；业务项目记录完整 commit SHA，tag 用于阅读，SHA 用于精确定位。
- 独立导出的项目不会自动同步模板。修复按需迁移，迁移后更新来源记录或追加迁移记录，再运行完整检查。
- 保留模板历史的项目可以利用共同祖先合并，但仍需解决冲突并检查业务行为。
- 公共组件和工具若需要多个业务项目长期统一升级，再评估提取共享 package；页面和业务逻辑继续由各业务项目维护。
- 不将模板作为整个应用的 Git submodule：后续需要直接修改品牌、路由和业务页面，独立工作目录更符合这里的用途。

开始业务开发前阅读 [项目约束总表](./constraints.md)；开发与检查命令见 [workflow.md](./workflow.md)。
