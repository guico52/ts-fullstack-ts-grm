/**
 * 需要真实 PostgreSQL 的集成测试：覆盖 rbac 各模块及关联读写。
 *
 * 默认 `bun test` **不会**运行它：只有显式 `PG_INTEGRATION=1 bun test tests/integration`
 * 时才启用。运行前需先生成项目初始迁移，再对独立空测试库执行 `bun run db:deploy`。
 *
 * 说明：`pool` 是全局单例，所以集成测试放在同一个文件里，只关一次池。
 */
import { afterAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { permissionOptions } from "../../src/plugins/permission-catalog.ts";
import { createApp } from "../../src/app.ts";
import { close, pool } from "../../src/model/index.ts";
import { ensureAdminUser } from "../../src/modules/rbac/user/bootstrap.ts";
import {
  ROLE_ADMIN,
  ROLE_VIEWER,
  seedSystemData,
} from "../../src/modules/rbac/seed.ts";

const enabled = process.env.PG_INTEGRATION === "1";
// 加时间戳，避免多次运行时相互冲突。
const STAMP = Date.now();

// 一个应用与一组请求助手：工厂设计使得多次 `createApp()` 也各自独立。
const app = createApp();

/**
 * 业务路由现在都过 `authGuard` + `permissionGuard`，所以测试得有个身份。
 *
 * 先初始化管理员与默认数据，再登录一次，之后 `call` 自动带上它的 token。凭据来自 `.env`
 * （`ADMIN_EMAIL` / `ADMIN_PWD`）—— 测试本来就依赖 `.env` 里的数据库连接，
 * 再依赖这一对不算多。
 *
 * 权限守卫**每次请求都查库**，所以这个 token 背后的权限是实时的，不是签发的
 * 那一刻的快照。
 */
let adminToken = "";

function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (adminToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${adminToken}`);
  }
  return app.handle(
    new Request(`http://localhost${path}`, { ...init, headers }),
  );
}

function send(path: string, method: string, body: unknown) {
  return call(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

if (enabled) {
  await app.decorator.permissionCatalog.start(app.routes);
  await seedSystemData();
  const response = await app.handle(
    new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL ?? "admin@example.com",
        password: process.env.ADMIN_PWD ?? "",
      }),
    }),
  );
  if (!response.ok) {
    throw new Error(
      `集成测试无法以 admin 登录（${response.status}），检查 .env 的 ADMIN_*`,
    );
  }
  adminToken = ((await response.json()) as { token: string }).token;
}

describe.skipIf(!enabled)("rbac（真实 pg）", () => {
  async function createOrganization(code: string) {
    return json<{
      id: string;
      name: string;
      code: string;
      logo: string | null;
    }>(await send("/rbac/organizations", "POST", { name: "IT-组织", code }));
  }

  afterAll(async () => {
    // 按外键顺序硬删，避免给开发库留下测试残留。
    await pool.query(
      "DELETE FROM sys_role_user_mapping WHERE role_id IN (SELECT id FROM sys_role WHERE name LIKE 'IT-%')",
    );
    await pool.query(
      "DELETE FROM sys_role_view_mapping WHERE role_id IN (SELECT id FROM sys_role WHERE name LIKE 'IT-%')",
    );
    await pool.query(
      "DELETE FROM sys_role_permission_mapping WHERE role_id IN (SELECT id FROM sys_role WHERE name LIKE 'IT-%')",
    );
    await pool.query("DELETE FROM sys_role WHERE name LIKE 'IT-%'");
    await pool.query(
      "DELETE FROM sys_user WHERE email LIKE 'it-%@example.com'",
    );
    await pool.query(
      "DELETE FROM sys_view WHERE name LIKE 'IT-%' OR path LIKE '/it-%'",
    );
    await pool.query("DELETE FROM sys_permission WHERE code LIKE 'IT-%'");
    await pool.query(
      "DELETE FROM sys_organization WHERE code LIKE 'IT-%' OR code LIKE 'ORG-%'",
    );
  });

  it("organization：创建 → 读回 → 局部更新 → 软删除 → 再查不到", async () => {
    const code = `ORG-${STAMP}`;
    const created = await send("/rbac/organizations", "POST", {
      name: "示例组织",
      code,
      logo: "https://example.com/logo.png",
    });
    expect(created.status).toBe(201);
    const organization = await json<{
      id: string;
      name: string;
      code: string;
      logo: string | null;
    }>(created);
    expect(organization.id).toMatch(/^\d+$/);

    const list = await json<{ data: Array<{ id: string }> }>(
      await call("/rbac/organizations?limit=100"),
    );
    expect(list.data.map((row) => row.id)).toContain(organization.id);

    // 省略字段保留原值。
    const patched = await json<typeof organization>(
      await send(`/rbac/organizations/${organization.id}`, "PATCH", {
        name: "改名",
      }),
    );
    expect(patched.name).toBe("改名");
    expect(patched.logo).toBe("https://example.com/logo.png");

    // 显式 null 才置空。
    const cleared = await json<typeof organization>(
      await send(`/rbac/organizations/${organization.id}`, "PATCH", {
        logo: null,
      }),
    );
    expect(cleared.logo).toBeNull();

    expect(
      (
        await call(`/rbac/organizations/${organization.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
    expect((await call(`/rbac/organizations/${organization.id}`)).status).toBe(
      404,
    );

    const missing = await send("/rbac/organizations/999999999", "PATCH", {
      name: "x",
    });
    expect(missing.status).toBe(404);
  });

  it("权限 code 唯一，同一路由可以绑定不同 method", async () => {
    const body = { code: `IT-endpoint-${STAMP}`, url: `/it/${STAMP}`, method: "GET" };
    const created = await send("/rbac/permissions", "POST", body);
    expect(created.status).toBe(201);
    const permission = await json<{ id: string; code: string }>(created);
    expect(permission).not.toHaveProperty("name");
    expect((await send("/rbac/permissions", "POST", { code: body.code })).status).toBe(409);
    expect((await send("/rbac/permissions", "POST", { ...body, code: `IT-duplicate-${STAMP}` })).status).toBe(409);
    expect((await send("/rbac/permissions", "POST", { ...body, code: `IT-post-${STAMP}`, method: "POST" })).status).toBe(201);
    const cleared = await send(`/rbac/permissions/${permission.id}`, "PATCH", { url: null, method: null });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ url: null, method: null });
  });

  it("废弃权限失效但保留角色授权关系", async () => {
    const permission = (await pool.query("SELECT id FROM sys_permission WHERE code='book.book.read'")).rows[0];
    const count = async () => (await pool.query("SELECT count(*)::int AS n FROM sys_role_permission_mapping WHERE permission_id=$1", [permission.id])).rows[0].n;
    const before = await count();
    try {
      expect((await send(`/rbac/permissions/${permission.id}`, "PATCH", { deprecated: true })).status).toBe(200);
      expect((await call("/book/books")).status).toBe(403);
      expect((await json<{ permissions: string[] }>(await call("/auth/me/access"))).permissions).not.toContain("book.book.read");
      expect(await count()).toBe(before);
      await pool.query("UPDATE sys_permission SET deleted_at=now() WHERE id=$1", [permission.id]);
      await seedSystemData();
      expect((await pool.query("SELECT deleted_at FROM sys_permission WHERE id=$1", [permission.id])).rows[0].deleted_at).not.toBeNull();
    } finally {
      await pool.query("UPDATE sys_permission SET deprecated=false, deleted_at=null WHERE id=$1", [permission.id]);
    }
    expect((await call("/book/books")).status).toBe(200);
  });

  it("permission：创建 → 改标识 → 软删除", async () => {
    const created = await send("/rbac/permissions", "POST", {
      code: `IT-权限-${STAMP}`,
    });
    expect(created.status).toBe(201);
    const permission = await json<{ id: string; code: string }>(created);

    const patched = await send(`/rbac/permissions/${permission.id}`, "PATCH", {
      code: `IT-改标识-${STAMP}`,
    });
    expect(patched.status).toBe(200);
    expect((await json<{ code: string }>(patched)).code).toBe(
      `IT-改标识-${STAMP}`,
    );

    expect(
      (await call(`/rbac/permissions/${permission.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
    expect((await call(`/rbac/permissions/${permission.id}`)).status).toBe(404);
  });

  it("user：带所属组织创建，读回嵌套组织，改密码不影响展示", async () => {
    const org = await createOrganization(`IT-USER-ORG-${STAMP}`);

    const created = await send("/rbac/users", "POST", {
      name: "IT-用户",
      email: `it-user-${STAMP}@example.com`,
      password: "s3cret-pass",
      organizationId: org.id,
    });
    expect(created.status).toBe(201);
    const user = await json<{
      id: string;
      organization: { id: string; name: string };
    }>(created);
    expect(user.organization.id).toBe(org.id);
    // 口令不出现在任何响应里。
    expect(JSON.stringify(user)).not.toContain("pwd");

    expect(
      (
        await send(`/rbac/users/${user.id}`, "PATCH", {
          password: "another-pass",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await send(`/rbac/users/${user.id}/password`, "POST", {
          newPassword: "another-pass",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await json<{ organization: { id: string } }>(
          await call(`/rbac/users/${user.id}`),
        )
      ).organization.id,
    ).toBe(org.id);

    // 引用不存在的组织 → 外键错误被分类成 422。
    const badRef = await send("/rbac/users", "POST", {
      name: "IT-坏引用",
      email: `it-bad-${STAMP}@example.com`,
      password: "s3cret-pass",
      organizationId: "999999999",
    });
    expect(badRef.status).toBe(422);
    expect(await json<{ code: string }>(badRef)).toMatchObject({
      code: "INVALID_REFERENCE",
    });
  });

  it("view：菜单 → 页面 → 按钮，层级由 parentId 表达", async () => {
    const menu = await json<{ id: string; type: string; path: string | null }>(
      await send("/rbac/views", "POST", {
        name: "IT-菜单",
        icon: "folder",
        type: "MENU",
      }),
    );
    // 菜单是分组节点：不承载组件，也没有路由。
    expect(menu.path).toBeNull();

    const page = await json<{
      id: string;
      parentId: string | null;
      componentName: string | null;
    }>(
      await send("/rbac/views", "POST", {
        name: "IT-页面",
        icon: "file",
        type: "VIEW",
        parentId: menu.id,
        path: `/it-page-${STAMP}`,
        componentPath: "views/system/ViewsView.vue",
        componentName: "ViewsView",
      }),
    );
    expect(page.parentId).toBe(menu.id);
    expect(page.componentName).toBe("ViewsView");

    const button = await json<{ id: string; parentId: string | null }>(
      await send("/rbac/views", "POST", {
        name: "IT-按钮",
        icon: "zap",
        type: "BUTTON",
        parentId: page.id,
      }),
    );
    expect(button.parentId).toBe(page.id);

    // A 页面 may also stand on its own — it is an entry point, not only a
    // child of a menu.
    const topLevelPage = await json<{ id: string; parentId: string | null }>(
      await send("/rbac/views", "POST", {
        name: "IT-顶层页面",
        icon: "file",
        type: "VIEW",
        path: `/it-top-${STAMP}`,
        componentPath: "views/system/ViewsView.vue",
        componentName: "ViewsView",
      }),
    );
    expect(topLevelPage.parentId).toBeNull();

    const children = await json<{ data: Array<{ id: string }> }>(
      await call(`/rbac/views?parentId=${menu.id}`),
    );
    expect(children.data.map((row) => row.id)).toEqual([page.id]);
  });

  it("view：层级不合法一律 422", async () => {
    const menu = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-层级菜单",
        icon: "folder",
        type: "MENU",
      }),
    );
    const page = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-层级页面",
        icon: "file",
        type: "VIEW",
        parentId: menu.id,
      }),
    );

    const cases: Array<{ why: string; body: Record<string, unknown> }> = [
      {
        why: "页面挂在页面下",
        body: { name: "x", icon: "i", type: "VIEW", parentId: page.id },
      },
      {
        why: "按钮挂在菜单下（跨层）",
        body: { name: "x", icon: "i", type: "BUTTON", parentId: menu.id },
      },
      {
        why: "菜单有上级",
        body: { name: "x", icon: "i", type: "MENU", parentId: menu.id },
      },
      { why: "按钮没有上级", body: { name: "x", icon: "i", type: "BUTTON" } },
    ];
    for (const { why, body } of cases) {
      const response = await send("/rbac/views", "POST", body);
      expect(response.status, why).toBe(422);
      expect(await json<{ code: string }>(response), why).toMatchObject({
        code: "INVALID_HIERARCHY",
      });
    }

    // 只改类型也会被拦：页面降级成按钮后，上级仍是菜单，组合不成立。
    const demoted = await send(`/rbac/views/${page.id}`, "PATCH", {
      type: "BUTTON",
    });
    expect(demoted.status).toBe(422);
    expect(await json<{ code: string }>(demoted)).toMatchObject({
      code: "INVALID_HIERARCHY",
    });

    // 枚举本身的校验先于业务规则。
    const badType = await send("/rbac/views", "POST", {
      name: "x",
      icon: "i",
      type: "NOPE",
    });
    expect(badType.status).toBe(422);
    expect(await json<{ code: string }>(badType)).toMatchObject({
      code: "VALIDATION",
    });
  });

  it("view：排序按层级自动递增，显式值优先", async () => {
    const menuA = await json<{ id: string; sort: number }>(
      await send("/rbac/views", "POST", {
        name: "IT-排序A",
        icon: "i",
        type: "MENU",
      }),
    );
    const menuB = await json<{ id: string; sort: number }>(
      await send("/rbac/views", "POST", {
        name: "IT-排序B",
        icon: "i",
        type: "MENU",
      }),
    );
    // 同一层：后者接着前者。用相对值断言，因为库里的顶层节点不止这两个。
    expect(menuB.sort).toBe(menuA.sort + 1);

    const page = (parentId: string, key: string) =>
      send("/rbac/views", "POST", {
        name: `IT-排序页${key}`,
        icon: "i",
        type: "VIEW",
        parentId,
        path: `/it-sort-${key}`,
        componentPath: "views/system/ViewsView.vue",
        componentName: "ViewsView",
      });

    const page1 = await json<{ sort: number }>(await page(menuA.id, "1"));
    const page2 = await json<{ sort: number }>(await page(menuA.id, "2"));
    // 新菜单下的第一个子节点从 1 开始，而不是接着顶层。
    expect(page1.sort).toBe(1);
    expect(page2.sort).toBe(2);

    const other = await json<{ sort: number }>(await page(menuB.id, "3"));
    expect(other.sort).toBe(1);

    // 显式排序不被覆盖。
    const explicit = await json<{ sort: number }>(
      await send("/rbac/views", "POST", {
        name: "IT-排序显式",
        icon: "i",
        type: "MENU",
        sort: 99,
      }),
    );
    expect(explicit.sort).toBe(99);
  });

  it("view：从页面改成菜单会清空组件与路由", async () => {
    const menu = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-清空菜单",
        icon: "folder",
        type: "MENU",
      }),
    );
    const page = await json<{
      id: string;
      path: string | null;
      componentPath: string | null;
      componentName: string | null;
    }>(
      await send("/rbac/views", "POST", {
        name: "IT-清空页面",
        icon: "file",
        type: "VIEW",
        parentId: menu.id,
        path: `/it-clear-${STAMP}`,
        componentPath: "views/system/ViewsView.vue",
        componentName: "ViewsView",
      }),
    );
    expect(page.componentName).toBe("ViewsView");

    // 表单在这些字段被隐藏时发的就是这个：连同上级一起清掉。
    const cleared = await json<typeof page>(
      await send(`/rbac/views/${page.id}`, "PATCH", {
        type: "MENU",
        parentId: null,
        path: null,
        componentPath: null,
        componentName: null,
      }),
    );
    expect(cleared.path).toBeNull();
    expect(cleared.componentPath).toBeNull();
    expect(cleared.componentName).toBeNull();
  });

  it("user：所属组织被软删除后，引用读出来是 null", async () => {
    const org = await createOrganization(`ORG-NULL-${STAMP}`);
    const created = await send("/rbac/users", "POST", {
      name: "IT-用户",
      email: `it-null-${STAMP}@example.com`,
      password: "secret123",
      organizationId: org.id,
    });
    const user = await json<{
      id: string;
      organization: { id: string } | null;
    }>(created);
    expect(user.organization?.id).toBe(org.id);

    expect(
      (await call(`/rbac/organizations/${org.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);

    const after = await json<typeof user>(await call(`/rbac/users/${user.id}`));
    expect(after.organization).toBeNull();
  });

  it("role：创建即绑定三类关联，PATCH 只替换传入的那一类", async () => {
    const org = await createOrganization(`IT-ROLE-ORG-${STAMP}`);
    const user = await json<{ id: string }>(
      await send("/rbac/users", "POST", {
        name: "IT-角色用户",
        email: `it-role-user-${STAMP}@example.com`,
        password: "s3cret-pass",
        organizationId: org.id,
      }),
    );
    const viewMenu = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-角色菜单",
        icon: "folder",
        type: "MENU",
      }),
    );
    const view = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-角色视图",
        icon: "eye",
        parentId: viewMenu.id,
        path: `/it-role-view-${STAMP}`,
        componentPath: "views/role",
        componentName: "RoleView",
        type: "VIEW",
      }),
    );
    const permission = await json<{ id: string }>(
      await send("/rbac/permissions", "POST", { code: `IT-角色权限-${STAMP}` }),
    );

    const created = await send("/rbac/roles", "POST", {
      name: `IT-角色-${STAMP}`,
      userIds: [user.id],
      viewIds: [view.id],
      permissionIds: [permission.id],
    });
    expect(created.status).toBe(201);
    const role = await json<{
      id: string;
      users: Array<{ id: string }>;
      views: Array<{ id: string }>;
      permissions: Array<{ id: string }>;
    }>(created);
    expect(role.users.map((r) => r.id)).toEqual([user.id]);
    expect(role.views.map((r) => r.id)).toEqual([view.id]);
    expect(role.permissions.map((r) => r.id)).toEqual([permission.id]);

    // 只传 viewIds：视图关联被清空，用户与权限关联原样保留。
    const patched = await json<typeof role>(
      await send(`/rbac/roles/${role.id}`, "PATCH", { viewIds: [] }),
    );
    expect(patched.views).toEqual([]);
    expect(patched.users.map((r) => r.id)).toEqual([user.id]);
    expect(patched.permissions.map((r) => r.id)).toEqual([permission.id]);

    expect(
      (await call(`/rbac/roles/${role.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect((await call(`/rbac/roles/${role.id}`)).status).toBe(404);
  });
});

describe.skipIf(!enabled)("book（真实 pg）", () => {
  afterAll(async () => {
    // 按外键顺序硬删，避免给开发库留下测试残留。
    await pool.query(
      "DELETE FROM book_author_mapping WHERE book_id IN (SELECT id FROM book WHERE name LIKE 'IT-%')",
    );
    await pool.query("DELETE FROM book WHERE name LIKE 'IT-%'");
    await pool.query("DELETE FROM author WHERE name LIKE 'IT-%'");
    await pool.query("DELETE FROM book_store WHERE name LIKE 'IT-%'");
  });

  const createStore = (name: string) =>
    send("/book/stores", "POST", { name: `IT-${name}-${STAMP}` });
  const createAuthor = (name: string) =>
    send("/book/authors", "POST", { name: `IT-${name}-${STAMP}` });

  it("store：创建 → 改名 → 软删除 → 再查不到", async () => {
    const created = await json<{ id: string; name: string }>(
      await createStore("书店"),
    );
    expect(created.name).toBe(`IT-书店-${STAMP}`);

    const renamed = await json<{ name: string }>(
      await send(`/book/stores/${created.id}`, "PATCH", {
        name: `IT-改名-${STAMP}`,
      }),
    );
    expect(renamed.name).toBe(`IT-改名-${STAMP}`);

    expect(
      (await call(`/book/stores/${created.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect((await call(`/book/stores/${created.id}`)).status).toBe(404);
  });

  it("book：创建即绑定作者，PATCH 只替换传入的那一类", async () => {
    const store = await json<{ id: string }>(await createStore("书店2"));
    const first = await json<{ id: string }>(await createAuthor("作者甲"));
    const second = await json<{ id: string }>(await createAuthor("作者乙"));

    const created = await send("/book/books", "POST", {
      name: `IT-图书-${STAMP}`,
      edition: 1,
      price: 42.5,
      storeId: store.id,
      authorIds: [first.id, second.id],
    });
    expect(created.status).toBe(201);
    const book = await json<{
      id: string;
      name: string;
      price: number;
      store: { id: string; name: string };
      authors: Array<{ id: string; name: string }>;
    }>(created);
    // price 是 numeric 列，出参必须是数字而不是字符串 —— 前端表单按数字校验。
    expect(book.price).toBe(42.5);
    expect(typeof book.price).toBe("number");
    expect(book.store.id).toBe(store.id);
    expect(book.authors.map((a) => a.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    // 传了 authorIds 就整体替换。
    const replaced = await json<typeof book>(
      await send(`/book/books/${book.id}`, "PATCH", { authorIds: [second.id] }),
    );
    expect(replaced.authors.map((a) => a.id)).toEqual([second.id]);

    // 没传 authorIds 就原样保留，只改名称。
    const renamed = await json<typeof book>(
      await send(`/book/books/${book.id}`, "PATCH", {
        name: `IT-图书改名-${STAMP}`,
      }),
    );
    expect(renamed.name).toBe(`IT-图书改名-${STAMP}`);
    expect(renamed.authors.map((a) => a.id)).toEqual([second.id]);

    expect(
      (await call(`/book/books/${book.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect((await call(`/book/books/${book.id}`)).status).toBe(404);
  });

  it("book：外键指向不存在的书店返回 422", async () => {
    const response = await send("/book/books", "POST", {
      name: `IT-孤儿书-${STAMP}`,
      edition: 1,
      price: 1,
      storeId: "99999999",
    });
    expect(response.status).toBe(422);
    expect((await json<{ code: string }>(response)).code).toBe(
      "INVALID_REFERENCE",
    );
  });

  it("book：edition 传字符串返回 422", async () => {
    const store = await json<{ id: string }>(await createStore("书店3"));
    const response = await send("/book/books", "POST", {
      name: `IT-脏数据-${STAMP}`,
      edition: "第一版",
      price: 1,
      storeId: store.id,
    });
    expect(response.status).toBe(422);
  });

  it("book：被软删除的书店与作者不再出现在关联里", async () => {
    const store = await json<{ id: string }>(await createStore("书店4"));
    const author = await json<{ id: string }>(await createAuthor("作者丙"));

    const created = await send("/book/books", "POST", {
      name: `IT-孤儿-${STAMP}`,
      edition: 1,
      price: 1,
      storeId: store.id,
      authorIds: [author.id],
    });
    expect(created.status).toBe(201);
    const book = await json<{
      id: string;
      store: { id: string; name: string } | null;
      authors: Array<{ id: string }>;
    }>(created);
    expect(book.store?.id).toBe(store.id);
    expect(book.authors.map((a) => a.id)).toEqual([author.id]);

    // 全局过滤器按列名注册，**关联查询也被它管着**：软删除书店与作者后，
    // 书还是那本书，但两边的引用都读不出来了。
    expect(
      (await call(`/book/stores/${store.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect(
      (await call(`/book/authors/${author.id}`, { method: "DELETE" })).status,
    ).toBe(200);

    const after = await json<typeof book>(await call(`/book/books/${book.id}`));
    // 契约里写明了可能是 null —— store_id 仍是那本书的，只是指向的行没了。
    expect(after.store).toBeNull();
    // 作者是列表，所以表现为“少一个”而不是 null。
    expect(after.authors).toEqual([]);
  });
});

describe.skipIf(!enabled)("auth（真实 pg）", () => {
  afterAll(async () => {
    await pool.query(
      "DELETE FROM sys_user WHERE email LIKE 'it-%@example.com'",
    );
    await pool.query(
      "DELETE FROM sys_organization WHERE code LIKE 'IT-%' OR code LIKE 'ORG-%'",
    );
  });

  const EMAIL = `it-login-${STAMP}@example.com`;
  const PASSWORD = "secret123";

  /** 建一个能登录的用户。组织是必填列，所以先有一个。 */
  async function makeUser() {
    const org = await json<{ id: string }>(
      await send("/rbac/organizations", "POST", {
        name: "IT-登录组织",
        code: `IT-LOGIN-${STAMP}`,
      }),
    );
    const created = await send("/rbac/users", "POST", {
      name: "IT-登录用户",
      email: EMAIL,
      password: PASSWORD,
      organizationId: org.id,
    });
    expect(created.status).toBe(201);
    return json<{ id: string }>(created);
  }

  it("login：正确凭据拿到本人，响应里没有哈希", async () => {
    await makeUser();

    const response = await send("/auth/login", "POST", {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(response.status).toBe(200);

    const session = await json<Record<string, unknown>>(response);
    expect(session).toMatchObject({ name: "IT-登录用户", email: EMAIL });
    // 字段集合本身就是要断言的东西：多一个 pwdHash 就是泄了口令。
    expect(Object.keys(session).sort()).toEqual([
      "email",
      "id",
      "mustChangePassword",
      "name",
      "token",
    ]);
    // token 是三段式 JWT，不是随便一个字符串。
    expect(String(session.token).split(".")).toHaveLength(3);
  });

  it("login：口令不对与邮箱不存在是同一种失败", async () => {
    const wrongPassword = await send("/auth/login", "POST", {
      email: EMAIL,
      password: "wrong-password",
    });
    const noSuchUser = await send("/auth/login", "POST", {
      email: `it-nobody-${STAMP}@example.com`,
      password: PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    // 响应体必须一模一样，否则匿名调用方可以拿它探测邮箱是否注册过。
    expect(await wrongPassword.json()).toEqual(await noSuchUser.json());
  });
});

describe.skipIf(!enabled)("bootstrap（真实 pg）", () => {
  it("持久标记使改名、撤销角色、软删除后 seed 都不重建或恢复", async () => {
    const initial = (
      await pool.query("SELECT * FROM sys_user WHERE initial_admin = true")
    ).rows[0];
    const memberships = (
      await pool.query(
        "SELECT role_id FROM sys_role_user_mapping WHERE user_id = $1",
        [initial.id],
      )
    ).rows;
    try {
      await pool.query(
        "UPDATE sys_user SET name = 'renamed-admin', deleted_at = now() WHERE id = $1",
        [initial.id],
      );
      await pool.query("DELETE FROM sys_role_user_mapping WHERE user_id = $1", [
        initial.id,
      ]);
      await seedSystemData({
        email: "changed@example.com",
        password: "another-secret",
      });
      expect(
        (
          await pool.query(
            "SELECT COUNT(*)::int AS count FROM sys_user WHERE initial_admin = true",
          )
        ).rows[0].count,
      ).toBe(1);
      expect(
        (
          await pool.query(
            "SELECT * FROM sys_role_user_mapping WHERE user_id = $1",
            [initial.id],
          )
        ).rows,
      ).toHaveLength(0);
      const after = (
        await pool.query("SELECT * FROM sys_user WHERE id = $1", [initial.id])
      ).rows[0];
      expect(after.name).toBe("renamed-admin");
      expect(after.email).toBe(initial.email);
      expect(after.pwd_hash).toBe(initial.pwd_hash);
      expect(after.deleted_at).not.toBeNull();
    } finally {
      await pool.query(
        "UPDATE sys_user SET name = $2, deleted_at = $3 WHERE id = $1",
        [initial.id, initial.name, initial.deleted_at],
      );
      for (const membership of memberships)
        await pool.query(
          "INSERT INTO sys_role_user_mapping (role_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [membership.role_id, initial.id],
        );
    }
  });
  it("初始化管理员属于真实组织，重复初始化保留凭据", async () => {
    await ensureAdminUser({
      email: "changed@example.com",
      password: "another-secret",
    });
    const joined = await pool.query(
      "SELECT u.email FROM sys_user u JOIN sys_organization o ON o.id = u.organization_id WHERE u.initial_admin = true",
    );
    expect(joined.rows).toHaveLength(1);
    expect(joined.rows[0].email).toBe(process.env.ADMIN_EMAIL);
  });
});

describe.skipIf(!enabled)("seed（真实 pg）", () => {
  /**
   * 这一组**不清理**。
   *
   * seed 建出来的视图、权限与角色就是系统要用的原始数据，不是测试垃圾；
   * 它幂等，重跑只会补缺，不会改已有行。删掉它们反而会把开发库弄坏。
   */

  it("默认视图包含总览与全部系统管理页面", async () => {
    const { rows } = await pool.query(
      "SELECT path FROM sys_view WHERE deleted_at IS NULL AND type = 'VIEW'",
    );
    const paths = rows.map((row) => row.path);
    for (const path of [
      "/",
      "/system/organizations",
      "/system/users",
      "/system/views",
      "/system/roles",
      "/system/permissions",
      "/library/books",
      "/library/authors",
      "/library/stores",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("第二次调用不新建任何东西", async () => {
    await seedSystemData();
    const counts = () =>
      pool.query(
        `SELECT (SELECT count(*)::int FROM sys_view WHERE deleted_at IS NULL) views,
                (SELECT count(*)::int FROM sys_permission WHERE deleted_at IS NULL) perms,
                (SELECT count(*)::int FROM sys_role WHERE deleted_at IS NULL) roles`,
      );

    const before = (await counts()).rows[0];
    await seedSystemData();
    const after = (await counts()).rows[0];

    expect(after).toEqual(before);
  });

  it("超过 100 个视图时重跑仍幂等", async () => {
    const inserted = await pool.query(
      "INSERT INTO sys_view (name, icon, type, sort) SELECT 'IT-page-limit-' || n, 'File', 'VIEW', 0 FROM generate_series(1,105) n RETURNING id",
    );
    try {
      const before = (
        await pool.query(
          "SELECT count(*)::int AS count FROM sys_view WHERE deleted_at IS NULL",
        )
      ).rows[0].count;
      await seedSystemData();
      expect(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM sys_view WHERE deleted_at IS NULL",
          )
        ).rows[0].count,
      ).toBe(before);
    } finally {
      await pool.query("DELETE FROM sys_view WHERE id = ANY($1::bigint[])", [
        inserted.rows.map((r) => r.id),
      ]);
    }
  });

  it("管理员拿到全部视图与全部权限", async () => {
    await seedSystemData();

    const { rows } = await pool.query(
      `
      SELECT (SELECT count(*)::int FROM sys_view WHERE deleted_at IS NULL) views,
             (SELECT count(*)::int FROM sys_permission WHERE deleted_at IS NULL) perms,
             (SELECT count(*)::int FROM sys_role_view_mapping m
                JOIN sys_role r ON r.id = m.role_id WHERE r.name = $1) admin_views,
             (SELECT count(*)::int FROM sys_role_permission_mapping m
                JOIN sys_role r ON r.id = m.role_id WHERE r.name = $1) admin_perms`,
      [ROLE_ADMIN],
    );

    expect(rows[0].admin_views).toBe(rows[0].views);
    expect(rows[0].admin_perms).toBe(rows[0].perms);
  });

  it("观察者只能读图书业务，碰不到系统管理的视图", async () => {
    await seedSystemData();

    const permissions = await pool.query(
      `SELECT p.code FROM sys_role_permission_mapping m
         JOIN sys_permission p ON p.id = m.permission_id
         JOIN sys_role r ON r.id = m.role_id
        WHERE r.name = $1 ORDER BY p.code`,
      [ROLE_VIEWER],
    );
    // “不能删除和修改”就是这份清单的**形状**：只有 read。
    expect(permissions.rows.map((row) => row.code)).toEqual([
      "book.author.read",
      "book.book.read",
      "book.store.read",
    ]);

    const views = await pool.query(
      `SELECT v.name FROM sys_role_view_mapping m
         JOIN sys_view v ON v.id = m.view_id
         JOIN sys_role r ON r.id = m.role_id
        WHERE r.name = $1`,
      [ROLE_VIEWER],
    );
    // 期望值也 sort 一次：中文按 UTF-16 码点排，手写顺序容易想当然。
    const names = views.rows.map((row) => row.name).sort();
    expect(names).toEqual(["图书管理", "图书", "作者", "书店"].sort());

    // “不可访问系统管理页面”同样是一个否定断言：一个都不能在。
    const systemPages = [
      "系统管理",
      "用户管理",
      "视图管理",
      "角色管理",
      "权限管理",
    ];
    expect(names.filter((name) => systemPages.includes(name))).toEqual([]);
  });
});

describe.skipIf(!enabled)("鉴权与授权（真实 pg）", () => {
  const VIEWER_EMAIL = `it-viewer-${STAMP}@example.com`;
  const VIEWER_PWD = "viewer-secret-123";

  afterAll(async () => {
    // 观察者是本组临时造的用户；内置 admin 不动。
    await pool.query(
      "DELETE FROM sys_role_user_mapping WHERE user_id IN (SELECT id FROM sys_user WHERE email = $1)",
      [VIEWER_EMAIL],
    );
    await pool.query("DELETE FROM sys_user WHERE email = $1", [VIEWER_EMAIL]);
  });

  /** 登录并拿到 token。失败时直接抛，不返回半个凭据。 */
  async function login(email: string, password: string): Promise<string> {
    const response = await send("/auth/login", "POST", { email, password });
    expect(response.status).toBe(200);
    const body = await json<{ token: string }>(response);
    return body.token;
  }

  const asBearer = (token: string) => ({
    headers: { authorization: `Bearer ${token}` },
  });

  /** 带 token 的写请求。`send` 不带 headers，所以这里手写一份。 */
  const authSend = (
    token: string,
    path: string,
    method: string,
    body: unknown,
  ) =>
    call(path, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

  it("没有凭据访问业务路由一律 401，/health 不受影响", async () => {
    // 绕过 `call`：它会给每个请求带上 admin 的 token，而这一条要的正是“没有”。
    const anonymous = (path: string) =>
      app.handle(new Request(`http://localhost${path}`));

    expect((await anonymous("/rbac/views")).status).toBe(401);
    expect((await anonymous("/book/books")).status).toBe(401);
    expect((await anonymous("/health")).status).toBe(200);
  });

  it("坏 token 也是 401，而不是当成匿名放行", async () => {
    expect(
      (
        await call("/rbac/views", {
          headers: { authorization: "Bearer nonsense" },
        })
      ).status,
    ).toBe(401);
  });

  it("管理员带 token 能读业务路由，也拿得到自己的可达集合", async () => {
    const token = await login(
      process.env.ADMIN_EMAIL ?? "admin@example.com",
      process.env.ADMIN_PWD ?? "",
    );

    expect((await call("/rbac/views", asBearer(token))).status).toBe(200);

    const access = await json<{
      views: Array<{ path: string | null }>;
      permissions: string[];
    }>(await call("/auth/me/access", asBearer(token)));
    // 管理员角色是“全部”，所以这两个数字应当与库里的一致。
    const counts = await pool.query(
      `SELECT (SELECT count(*)::int FROM sys_view WHERE deleted_at IS NULL) views,
              (SELECT count(*)::int FROM sys_permission WHERE deleted_at IS NULL) perms`,
    );
    expect(access.views).toHaveLength(counts.rows[0].views);
    expect(access.permissions).toHaveLength(counts.rows[0].perms);
    // 前端拿它配路由，重复的 path 会让 addRoute 抛错。
    const paths = access.views
      .map((view) => view.path)
      .filter((path) => path !== null);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("观察者：能读图书业务，读不了系统管理，也改不了任何东西", async () => {
    // 造一个观察者：建用户 + 加入内置的「观察者」角色。
    const org = await json<{ id: string }>(
      await send("/rbac/organizations", "POST", {
        name: "IT-观察者组织",
        code: `IT-VIEWER-${STAMP}`,
      }),
    );
    const viewer = await json<{ id: string }>(
      await send("/rbac/users", "POST", {
        name: "IT-观察者",
        email: VIEWER_EMAIL,
        password: VIEWER_PWD,
        organizationId: org.id,
      }),
    );
    // 直接用 SQL 绑到内置的「观察者」角色：这时还没有 token，走不了 HTTP。
    const builtIn = await pool.query(
      "SELECT id FROM sys_role WHERE name = $1 AND deleted_at IS NULL",
      [ROLE_VIEWER],
    );
    await pool.query(
      "INSERT INTO sys_role_user_mapping (role_id, user_id) VALUES ($1, $2)",
      [builtIn.rows[0].id, viewer.id],
    );

    const token = await login(VIEWER_EMAIL, VIEWER_PWD);
    const auth = asBearer(token);

    // 读图书业务：可以。
    expect((await call("/book/books", auth)).status).toBe(200);
    expect((await call("/book/authors", auth)).status).toBe(200);

    // 读系统管理：403 —— 观察者的视图列表里没有它们，权限也不在其中。
    expect((await call("/rbac/views", auth)).status).toBe(403);
    expect((await call("/rbac/users", auth)).status).toBe(403);

    // 写图书业务：403 —— 手里只有 read，没有 create / update / delete。
    expect(
      (await authSend(token, "/book/authors", "POST", { name: "IT-不该建成" }))
        .status,
    ).toBe(403);
    expect(
      (await authSend(token, "/book/stores", "POST", { name: "IT-不该建成" }))
        .status,
    ).toBe(403);

    // 被拦住之后，库里不该多出任何东西 —— 403 必须发生在写入之前。
    const leaked = await pool.query(
      "SELECT count(*)::int n FROM author WHERE name LIKE 'IT-不该建成%'",
    );
    expect(leaked.rows[0].n).toBe(0);

    // 观察者的可达集合只剩图书管理那一组。
    const access = await json<{
      views: Array<{ name: string }>;
      permissions: string[];
    }>(await call("/auth/me/access", auth));
    expect(access.permissions).toEqual([
      "book.author.read",
      "book.book.read",
      "book.store.read",
    ]);
    expect(access.views.map((view) => view.name).sort()).toEqual(
      ["图书管理", "图书", "作者", "书店"].sort(),
    );
  });
});

describe.skipIf(!enabled)("我的资料与管理员权限升级（真实 pg）", () => {
  it("自己的资料来自数据库，组织软删除可为空，响应不含凭据", async () => {
    const response = await call("/auth/me");
    expect(response.status).toBe(200);
    const profile = await json<{ id: string; name: string; email: string; organization: { id: string } | null; roles: { name: string }[] }>(response);
    expect(profile.email).toBe(process.env.ADMIN_EMAIL ?? "admin@example.com");
    expect(profile.roles.map((r) => r.name)).toContain("管理员");
    expect(Object.keys(profile).sort()).toEqual(["email", "id", "mustChangePassword", "name", "organization", "roles"]);
    const user = await pool.query("SELECT id, organization_id, name FROM sys_user WHERE id=$1", [profile.id]);
    const orgId = user.rows[0].organization_id;
    const priorOrg = (await pool.query("SELECT deleted_at FROM sys_organization WHERE id=$1", [orgId])).rows[0];
    try {
      await pool.query("UPDATE sys_user SET name='IT-资料更新' WHERE id=$1", [profile.id]);
      await pool.query("UPDATE sys_organization SET deleted_at=now() WHERE id=$1", [orgId]);
      const changed = await json<{ name: string; organization: unknown }>(await call("/auth/me?userId=999"));
      expect(changed.name).toBe("IT-资料更新");
      expect(changed.organization).toBeNull();
    } finally {
      await pool.query("UPDATE sys_user SET name=$2 WHERE id=$1", [profile.id, user.rows[0].name]);
      await pool.query("UPDATE sys_organization SET deleted_at=$2 WHERE id=$1", [orgId, priorOrg.deleted_at]);
    }
    expect((await app.handle(new Request("http://localhost/auth/me"))).status).toBe(401);
  });
  it("管理员撤销权限后，seed 不恢复授权", async () => {
    const role = (await pool.query("SELECT id FROM sys_role WHERE name='管理员' AND deleted_at IS NULL ORDER BY id LIMIT 1")).rows[0];
    const permission = (await pool.query("SELECT id FROM sys_permission WHERE code='rbac.user.resetPassword' AND deleted_at IS NULL ORDER BY id LIMIT 1")).rows[0];
    try {
      await pool.query("DELETE FROM sys_role_permission_mapping WHERE role_id=$1 AND permission_id=$2", [role.id, permission.id]);
      const links = () => pool.query("SELECT * FROM sys_role_permission_mapping WHERE role_id=$1 AND permission_id=$2", [role.id, permission.id]);
      await seedSystemData();
      expect((await links()).rows).toHaveLength(0);
    } finally { await pool.query("INSERT INTO sys_role_permission_mapping (role_id,permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [role.id,permission.id]); }
  });
});

describe.skipIf(!enabled)("密码生命周期（真实 pg）", () => {
  afterAll(async () => {
    await pool.query(
      "DELETE FROM sys_role_user_mapping WHERE role_id IN (SELECT id FROM sys_role WHERE name = $1)",
      [`IT-password-role-${STAMP}`],
    );
    await pool.query(
      "DELETE FROM sys_role_permission_mapping WHERE role_id IN (SELECT id FROM sys_role WHERE name = $1)",
      [`IT-password-role-${STAMP}`],
    );
    await pool.query("DELETE FROM sys_role WHERE name = $1", [
      `IT-password-role-${STAMP}`,
    ]);
    await pool.query("DELETE FROM sys_user WHERE email = $1", [
      `it-password-${STAMP}@example.com`,
    ]);
  });
  it("用户自行改密、管理员重置、强制改密及旧 JWT 撤销", async () => {
    const org = (
      await pool.query(
        "SELECT id FROM sys_organization WHERE deleted_at IS NULL LIMIT 1",
      )
    ).rows[0];
    const email = `it-password-${STAMP}@example.com`;
    const created = await send("/rbac/users", "POST", {
      name: "IT-密码测试",
      email,
      password: "original-password",
      organizationId: String(org.id),
    });
    const userId = (await json<{ id: string }>(created)).id;
    const login = async (password: string) => {
      const response = await send("/auth/login", "POST", { email, password });
      expect(response.status).toBe(200);
      return response.json() as Promise<{
        token: string;
        mustChangePassword: boolean;
      }>;
    };
    const withToken = (token: string, path: string, body?: unknown) =>
      call(path, {
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body === undefined
          ? {}
          : { method: "POST", body: JSON.stringify(body) }),
      });
    const grants = await pool.query(
      "SELECT id FROM sys_permission WHERE code IN ('rbac.user.create', 'rbac.user.update', 'book.book.read') AND deleted_at IS NULL",
    );
    const role = await send("/rbac/roles", "POST", {
      name: `IT-password-role-${STAMP}`,
      userIds: [userId],
      permissionIds: grants.rows.map((p) => String(p.id)),
    });
    expect(role.status).toBe(201);
    const first = await login("original-password");
    const own = await withToken(first.token, "/auth/me");
    expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ id: userId, email });
    const second = await login("original-password");
    expect(
      (
        await withToken(first.token, `/rbac/users/${userId}/password`, {
          newPassword: "unauthorized-reset",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await withToken(first.token, `/rbac/users/${userId}/password/`, {
          newPassword: "unauthorized-reset",
        })
      ).status,
    ).toBe(403);
    const encodedId = `%${userId.charCodeAt(0).toString(16)}${userId.slice(1)}`;
    expect(
      (
        await withToken(first.token, `/rbac/users/${encodedId}/password`, {
          newPassword: "unauthorized-reset",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await withToken(first.token, "/auth/me/password", {
          currentPassword: "wrong-password",
          newPassword: "new-password",
        })
      ).status,
    ).toBe(422);
    expect((await withToken(first.token, "/auth/me/access")).status).toBe(200);
    expect(
      (
        await withToken(first.token, "/auth/me/password", {
          currentPassword: "original-password",
          newPassword: "original-password",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await withToken(first.token, "/auth/me/password", {
          currentPassword: "original-password",
          newPassword: "new-password",
        })
      ).status,
    ).toBe(200);
    for (const token of [first.token, second.token])
      expect((await withToken(token, "/auth/me/access")).status).toBe(401);
    expect(
      (
        await send("/auth/login", "POST", {
          email,
          password: "original-password",
        })
      ).status,
    ).toBe(401);
    const next = await login("new-password");
    expect(next.mustChangePassword).toBe(false);
    expect(
      (
        await send(`/rbac/users/${userId}/password`, "POST", {
          newPassword: "temporary-password",
        })
      ).status,
    ).toBe(200);
    expect((await withToken(next.token, "/auth/me/access")).status).toBe(401);
    const temporary = await login("temporary-password");
    expect((await withToken(temporary.token, "/auth/me/access")).status).toBe(
      200,
    );
    expect(temporary.mustChangePassword).toBe(true);
    const blocked = await withToken(temporary.token, "/book/books");
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    expect(
      (
        await withToken(temporary.token, "/auth/me/password", {
          currentPassword: "temporary-password",
          newPassword: "final-password",
        })
      ).status,
    ).toBe(200);
    expect((await withToken(temporary.token, "/auth/me/access")).status).toBe(
      401,
    );
    const final = await login("final-password");
    expect(final.mustChangePassword).toBe(false);
    expect((await withToken(final.token, "/book/books")).status).toBe(200);
    await seedSystemData();
    await login("final-password");
    expect(
      (
        await send(`/rbac/users/${userId}/password`, "POST", {
          newPassword: "short",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await send("/rbac/users/999999999/password", "POST", {
          newPassword: "temporary-password",
        })
      ).status,
    ).toBe(404);
    await send(`/rbac/users/${userId}`, "DELETE", undefined);
    expect((await withToken(final.token, "/auth/me/access")).status).toBe(401);
  });
});

describe.skipIf(!enabled)("权限自动托管插件（真实 pg）", () => {
  it("自动启动同步、变更定位、废弃、冲突回滚和授权即时生效", async () => {
    type Route = { path: string; method: "GET" | "POST"; permission?: string | false };
    const prefix = `/IT-plugin-${STAMP}`;
    const stableCode = `IT-plugin-stable-${STAMP}`;
    const initial: Route[] = [
      { method: "GET", path: `${prefix}/stable`, permission: stableCode },
      { method: "GET", path: `${prefix}/items/:id` },
      { method: "GET", path: `${prefix}/method` },
      { method: "POST", path: `${prefix}/method` },
      { method: "GET", path: `${prefix}/profile`, permission: false },
    ];
    const build = (definitions: Route[]) => {
      const routes = new Elysia({ name: "IT-permission-endpoints" }).use(permissionOptions);
      for (const definition of definitions) {
        routes.route(definition.method, definition.path, () => ({ ok: true }),
          definition.permission === undefined ? {} : { permission: definition.permission });
      }
      return createApp().use(routes);
    };
    const rows = () => pool.query("SELECT id, code, url, method, deprecated, deleted_at FROM sys_permission WHERE url LIKE $1 OR code LIKE $2 ORDER BY id", [`${prefix}%`, `IT-plugin-%-${STAMP}`]);
    const idFor = async (code: string) => String((await pool.query("SELECT id FROM sys_permission WHERE code=$1", [code])).rows[0].id);
    const invoke = (target: ReturnType<typeof build>, path: string, token = adminToken) => target.handle(new Request(`http://localhost${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));
    const roleId = (await pool.query("SELECT id FROM sys_role WHERE name=$1 AND deleted_at IS NULL", [ROLE_ADMIN])).rows[0].id;
    const grant = (id: string) => pool.query("INSERT INTO sys_role_permission_mapping(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [roleId, id]);
    const boot = build(initial);
    try {
      // 使用实际 Elysia onStart，而不是只调用同步函数。
      boot.listen({ hostname: "127.0.0.1", port: 0 });
      await boot.decorator.permissionCatalog.ready();
      expect((await rows()).rows).toHaveLength(4);
      expect((await pool.query("SELECT * FROM sys_permission WHERE url=$1", [`${prefix}/profile`])).rows).toHaveLength(0);
      const stableId = await idFor(stableCode);
      const generatedCode = `GET:${prefix}/items/:id`;
      const generatedId = await idFor(generatedCode);
      expect((await invoke(boot, `${prefix}/stable`)).status).toBe(403);
      await grant(stableId);
      await grant(generatedId);
      expect((await invoke(boot, `${prefix}/stable`)).status).toBe(200);
      expect((await invoke(boot, `${prefix}/items/123`)).status).toBe(200);
      expect((await invoke(boot, `${prefix}/profile`, "")).status).toBe(401);
      expect((await invoke(boot, `${prefix}/profile`)).status).toBe(200);
      const admin = (await pool.query("SELECT id, must_change_password FROM sys_user WHERE initial_admin=true")).rows[0];
      try {
        await pool.query("UPDATE sys_user SET must_change_password=true WHERE id=$1", [admin.id]);
        expect((await invoke(boot, `${prefix}/profile`)).status).toBe(403);
      } finally {
        await pool.query("UPDATE sys_user SET must_change_password=$2 WHERE id=$1", [admin.id, admin.must_change_password]);
      }
      const before = (await rows()).rows;
      await Promise.all([
        boot.decorator.permissionCatalog.synchronize(boot.routes),
        boot.decorator.permissionCatalog.synchronize(boot.routes),
      ]);
      expect((await rows()).rows).toEqual(before);
      // 固定 code 改路由：保留 ID 与授予关系。
      const movedRoutes = initial.map((route) => route.permission === stableCode ? { ...route, path: `${prefix}/renamed` } : route);
      const moved = build(movedRoutes);
      await moved.decorator.permissionCatalog.start(moved.routes);
      expect(await idFor(stableCode)).toBe(stableId);
      expect((await invoke(moved, `${prefix}/renamed`)).status).toBe(200);
      // 固定接口改 code：通过 url + method 定位到同一行。
      const renamedCode = `IT-plugin-renamed-${STAMP}`;
      const renamedRoutes = movedRoutes.map((route) => route.permission === stableCode ? { ...route, permission: renamedCode } : route);
      const renamed = build(renamedRoutes);
      await renamed.decorator.permissionCatalog.start(renamed.routes);
      expect(await idFor(renamedCode)).toBe(stableId);
      expect((await invoke(renamed, `${prefix}/renamed`)).status).toBe(200);
      // 在改路由时显式固定原自动 code，可以沿用原记录和授权。
      const pinned = build(renamedRoutes.map((route) => route.path === `${prefix}/items/:id` ? { ...route, path: `${prefix}/pinned-items/:id`, permission: generatedCode } : route));
      await pinned.decorator.permissionCatalog.start(pinned.routes);
      expect(await idFor(generatedCode)).toBe(generatedId);
      expect((await invoke(pinned, `${prefix}/pinned-items/123`)).status).toBe(200);
      // 自动 code 随路由一起变更：创建新记录，旧记录废弃，保留旧角色关系。
      const changedRoutes = renamedRoutes.map((route) => route.path === `${prefix}/items/:id` ? { ...route, path: `${prefix}/entries/:id` } : route);
      const changed = build(changedRoutes);
      await changed.decorator.permissionCatalog.start(changed.routes);
      expect(await idFor(`GET:${prefix}/entries/:id`)).not.toBe(generatedId);
      expect((await pool.query("SELECT deprecated FROM sys_permission WHERE id=$1", [generatedId])).rows[0].deprecated).toBe(true);
      expect((await pool.query("SELECT * FROM sys_role_permission_mapping WHERE role_id=$1 AND permission_id=$2", [roleId, generatedId])).rows).toHaveLength(1);
      expect((await invoke(changed, `${prefix}/entries/123`)).status).toBe(403);
      // 删路由不删记录；重新出现则恢复有效状态，沿用原授权。
      const removed = build(changedRoutes.filter((route) => route.permission !== renamedCode));
      await removed.decorator.permissionCatalog.start(removed.routes);
      expect((await pool.query("SELECT deprecated FROM sys_permission WHERE id=$1", [stableId])).rows[0].deprecated).toBe(true);
      const restored = build(changedRoutes);
      await restored.decorator.permissionCatalog.start(restored.routes);
      expect((await invoke(restored, `${prefix}/renamed`)).status).toBe(200);
      // 管理员删除是持久操作，托管同步不会恢复 deleted_at。
      await pool.query("UPDATE sys_permission SET deleted_at=now() WHERE id=$1", [stableId]);
      await restored.decorator.permissionCatalog.synchronize(restored.routes);
      expect((await invoke(restored, `${prefix}/renamed`)).status).toBe(403);
      expect((await pool.query("SELECT deleted_at FROM sys_permission WHERE id=$1", [stableId])).rows[0].deleted_at).not.toBeNull();
      await pool.query("UPDATE sys_permission SET deleted_at=null WHERE id=$1", [stableId]);
      // 两个唯一键指向不同记录：拒绝猜测，整笔事务回滚。
      const snapshot = (await rows()).rows;
      const conflicting = build([{ method: "GET", path: `${prefix}/entries/:id`, permission: renamedCode }]);
      await expect(conflicting.decorator.permissionCatalog.synchronize(conflicting.routes)).rejects.toThrow("权限定位冲突");
      expect((await rows()).rows).toEqual(snapshot);
    } finally {
      if (boot.server) await boot.stop();
      await pool.query("DELETE FROM sys_role_permission_mapping WHERE permission_id IN (SELECT id FROM sys_permission WHERE url LIKE $1 OR code LIKE $2)", [`${prefix}%`, `IT-plugin-%-${STAMP}`]);
      await pool.query("DELETE FROM sys_permission WHERE url LIKE $1 OR code LIKE $2", [`${prefix}%`, `IT-plugin-%-${STAMP}`]);
      await app.decorator.permissionCatalog.synchronize(app.routes);
    }
  });
});

/**
 * 池是全局单例，**整份文件只关一次**。
 *
 * 每个 describe 各自 `close()` 会让先跑完的那个关掉池，后面 describe 的
 * 查询全部报 “Cannot use a pool after calling end”。所以清理下放到各
 * describe，关闭只留在这一处。
 */
afterAll(async () => {
  if (enabled) await close();
});
