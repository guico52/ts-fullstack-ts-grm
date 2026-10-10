import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app.ts";

const app = createApp();

function request(path: string, init?: RequestInit): Promise<Response> {
  return app.handle(new Request(`http://localhost${path}`, init));
}

function json(path: string, method: string, body: unknown): Promise<Response> {
  return request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("健康检查", () => {
  it("GET /health 返回 ok", async () => {
    const response = await request("/health");
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThan(0);
  });
});

describe("开发接口文档与认证边界", () => {
  it("Swagger 可匿名访问并声明 Bearer 授权", async () => {
    if (
      process.env.ENABLE_DOCS === "false" ||
      (process.env.NODE_ENV === "production" &&
        process.env.ENABLE_DOCS !== "true")
    )
      return;
    expect((await request("/docs")).status).toBe(200);
    const response = await request("/docs/json");
    expect(response.status).toBe(200);
    const spec = await response.json() as {
      components: { securitySchemes: { bearerAuth: { scheme: string } } };
      paths: { "/auth/login": { post: { security: unknown[] } } };
    };
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(spec.paths["/auth/login"].post.security).toEqual([]);
  });
  it("业务路由不能因开放文档而匿名访问", async () => {
    expect((await request("/rbac/users")).status).toBe(401);
  });
});

describe("请求校验（不触达数据库）", () => {
  it("POST /rbac/organizations 拒绝空 name", async () => {
    const response = await json("/rbac/organizations", "POST", {
      name: "  ",
      code: "A",
    });
    expect(response.status).toBe(422);
    // 统一错误体，而不是 Elysia 的默认校验响应。
    expect(await response.json()).toMatchObject({ code: "VALIDATION" });
  });

  it("POST /rbac/organizations 拒绝类型错误的 body", async () => {
    const response = await json("/rbac/organizations", "POST", {
      name: 42,
      code: "B",
    });
    expect(response.status).toBe(422);
  });

  it("GET /rbac/organizations/:id 在 id 不是数字时返回 422", async () => {
    const response = await request("/rbac/organizations/not-a-number");
    expect(response.status).toBe(422);
  });

  it("PATCH 拒绝空对象（minProperties）", async () => {
    const response = await json("/rbac/organizations/1", "PATCH", {});
    expect(response.status).toBe(422);
  });

  it("GET /rbac/organizations 拒绝超上限的 limit", async () => {
    const response = await request("/rbac/organizations?limit=999");
    expect(response.status).toBe(422);
  });

  it("POST /rbac/users 拒绝非法 email", async () => {
    const response = await json("/rbac/users", "POST", {
      name: "A",
      email: "not-an-email",
      password: "s3cret-pass",
      organizationId: "1",
    });
    expect(response.status).toBe(422);
  });

  it("POST /rbac/views 拒绝未知 type", async () => {
    const response = await json("/rbac/views", "POST", {
      name: "A",
      icon: "i",
      path: "/a",
      componentPath: "a",
      type: "NOPE",
    });
    expect(response.status).toBe(422);
  });

  it("POST /rbac/roles 拒绝非数字的关联 id", async () => {
    const response = await json("/rbac/roles", "POST", {
      name: "A",
      userIds: ["abc"],
    });
    expect(response.status).toBe(422);
  });

  it("PATCH /rbac/permissions/:id 拒绝空对象", async () => {
    const response = await json("/rbac/permissions/1", "PATCH", {});
    expect(response.status).toBe(422);
  });

  it("POST /auth/login 拒绝缺字段", async () => {
    expect((await json("/auth/login", "POST", {})).status).toBe(422);
    expect(
      (await json("/auth/login", "POST", { email: "a@b.com" })).status,
    ).toBe(422);
    expect(
      (await json("/auth/login", "POST", { password: "secret123" })).status,
    ).toBe(422);
  });

  it("POST /auth/login 拒绝不像邮箱的 email", async () => {
    const response = await json("/auth/login", "POST", {
      email: "not-an-email",
      password: "secret123",
    });
    expect(response.status).toBe(422);
  });

  it("POST /auth/login 拒绝过短的口令", async () => {
    const response = await json("/auth/login", "POST", {
      email: "a@b.com",
      password: "123",
    });
    expect(response.status).toBe(422);
  });
});

describe("路由行为", () => {
  it("未定义的路径返回 404 JSON", async () => {
    const response = await request("/no-such-route");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });
});
