/**
 * 需要真实 PostgreSQL 的集成测试：覆盖 rbac 各模块及关联读写。
 *
 * 默认 `bun test` **不会**运行它：只有显式 `PG_INTEGRATION=1 bun test tests/integration`
 * 时才启用。运行前需先对目标库执行 `bun run db:deploy`（或 `db:dev`）。
 *
 * 说明：`pool` 是全局单例，所以集成测试放在同一个文件里，只关一次池。
 */
import { afterAll, describe, expect, it } from "bun:test";
import { createApp } from "../../src/app.ts";
import { close, pool } from "../../src/model/index.ts";

const enabled = process.env.PG_INTEGRATION === "1";
// 加时间戳，避免多次运行时相互冲突。
const STAMP = Date.now();

describe.skipIf(!enabled)("rbac（真实 pg）", () => {
  const app = createApp();

  function call(path: string, init?: RequestInit) {
    return app.handle(new Request(`http://localhost${path}`, init));
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
  async function createOrganization(code: string) {
    return json<{ id: string; name: string; code: string; logo: string | null }>(
      await send("/rbac/organizations", "POST", { name: "IT-组织", code }),
    );
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
    await pool.query("DELETE FROM sys_user WHERE email LIKE 'it-%@example.com'");
    await pool.query("DELETE FROM sys_view WHERE path LIKE '/it-%'");
    await pool.query("DELETE FROM sys_permission WHERE name LIKE 'IT-%'");
    await pool.query("DELETE FROM sys_organization WHERE code LIKE 'IT-%' OR code LIKE 'ORG-%'");
    await close();
  });

  it("organization：创建 → 读回 → 局部更新 → 软删除 → 再查不到", async () => {
    const code = `ORG-${STAMP}`;
    const created = await send("/rbac/organizations", "POST", {
      name: "示例组织",
      code,
      logo: "https://example.com/logo.png",
    });
    expect(created.status).toBe(201);
    const organization = await json<{ id: string; name: string; code: string; logo: string | null }>(created);
    expect(organization.id).toMatch(/^\d+$/);

    const list = await json<{ data: Array<{ id: string }> }>(
      await call("/rbac/organizations?limit=100"),
    );
    expect(list.data.map((row) => row.id)).toContain(organization.id);

    // 省略字段保留原值。
    const patched = await json<typeof organization>(
      await send(`/rbac/organizations/${organization.id}`, "PATCH", { name: "改名" }),
    );
    expect(patched.name).toBe("改名");
    expect(patched.logo).toBe("https://example.com/logo.png");

    // 显式 null 才置空。
    const cleared = await json<typeof organization>(
      await send(`/rbac/organizations/${organization.id}`, "PATCH", { logo: null }),
    );
    expect(cleared.logo).toBeNull();

    expect((await call(`/rbac/organizations/${organization.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await call(`/rbac/organizations/${organization.id}`)).status).toBe(404);

    const missing = await send("/rbac/organizations/999999999", "PATCH", { name: "x" });
    expect(missing.status).toBe(404);
  });

  it("permission：创建 → 改名 → 软删除", async () => {
    const created = await send("/rbac/permissions", "POST", { name: `IT-权限-${STAMP}` });
    expect(created.status).toBe(201);
    const permission = await json<{ id: string; name: string }>(created);

    const patched = await send(`/rbac/permissions/${permission.id}`, "PATCH", { name: `IT-改名-${STAMP}` });
    expect(patched.status).toBe(200);
    expect((await json<{ name: string }>(patched)).name).toBe(`IT-改名-${STAMP}`);

    expect((await call(`/rbac/permissions/${permission.id}`, { method: "DELETE" })).status).toBe(200);
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
    const user = await json<{ id: string; organization: { id: string; name: string } }>(created);
    expect(user.organization.id).toBe(org.id);
    // 口令不出现在任何响应里。
    expect(JSON.stringify(user)).not.toContain("pwd");

    const patched = await json<{ organization: { id: string } }>(
      await send(`/rbac/users/${user.id}`, "PATCH", { password: "another-pass" }),
    );
    expect(patched.organization.id).toBe(org.id);

    // 引用不存在的组织 → 外键错误被分类成 422。
    const badRef = await send("/rbac/users", "POST", {
      name: "IT-坏引用",
      email: `it-bad-${STAMP}@example.com`,
      password: "s3cret-pass",
      organizationId: "999999999",
    });
    expect(badRef.status).toBe(422);
    expect(await json<{ code: string }>(badRef)).toMatchObject({ code: "INVALID_REFERENCE" });
  });

  it("view：父子结构，可按 parentId 过滤，显式 null 回到根", async () => {
    const root = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-根菜单",
        icon: "folder",
        path: `/it-root-${STAMP}`,
        componentPath: "layout/root",
        type: "MENU",
      }),
    );
    const child = await json<{ id: string; parentId: string | null; type: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-子页",
        icon: "file",
        path: `/it-child-${STAMP}`,
        componentPath: "views/child",
        type: "VIEW",
        parentId: root.id,
        sort: 5,
      }),
    );
    expect(child.parentId).toBe(root.id);
    expect(child.type).toBe("VIEW");

    const children = await json<{ data: Array<{ id: string }> }>(await call(`/rbac/views?parentId=${root.id}`));
    expect(children.data.map((row) => row.id)).toEqual([child.id]);

    const moved = await json<{ parentId: string | null }>(
      await send(`/rbac/views/${child.id}`, "PATCH", { parentId: null }),
    );
    expect(moved.parentId).toBeNull();

    // type 是枚举，非法值被框架拦下。
    const badType = await send("/rbac/views", "POST", {
      name: "IT-坏类型",
      icon: "x",
      path: `/it-bad-${STAMP}`,
      componentPath: "x",
      type: "NOPE",
    });
    expect(badType.status).toBe(422);
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
    const view = await json<{ id: string }>(
      await send("/rbac/views", "POST", {
        name: "IT-角色视图",
        icon: "eye",
        path: `/it-role-view-${STAMP}`,
        componentPath: "views/role",
        type: "VIEW",
      }),
    );
    const permission = await json<{ id: string }>(
      await send("/rbac/permissions", "POST", { name: `IT-角色权限-${STAMP}` }),
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
    const patched = await json<typeof role>(await send(`/rbac/roles/${role.id}`, "PATCH", { viewIds: [] }));
    expect(patched.views).toEqual([]);
    expect(patched.users.map((r) => r.id)).toEqual([user.id]);
    expect(patched.permissions.map((r) => r.id)).toEqual([permission.id]);

    expect((await call(`/rbac/roles/${role.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await call(`/rbac/roles/${role.id}`)).status).toBe(404);
  });
});
