import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { createApp } from "../src/app.ts";
import { permissionGuard } from "../src/plugins/permission.ts";
import { permissionOptions } from "../src/plugins/permission-catalog.ts";

describe("权限目录与插件作用域", () => {
  it("只收集守卫后的接口，使用完整路由模板及 HTTP method", () => {
    const app = new Elysia()
      .get("/health", () => "ok")
      .use(permissionGuard())
      .use(new Elysia({ prefix: "/examples" })
        .get("/:id", () => "read")
        .post("/:id", () => "write"));
    expect(app.decorator.permissionCatalog.collect(app.routes)).toEqual([
      { code: "GET:/examples/:id", url: "/examples/:id", method: "GET" },
      { code: "POST:/examples/:id", url: "/examples/:id", method: "POST" },
    ]);
    expect(app.decorator.permissionCatalog.permissionFor("GET", "/examples/:id/")).toBe("GET:/examples/:id");
    expect(app.decorator.permissionCatalog.permissionFor("GET", "/examples/42")).toBeUndefined();
  });

  it("permission: false 不生成权限；显式 code 覆盖默认生成", () => {
    const app = new Elysia().use(permissionGuard()).use(new Elysia()
      .use(permissionOptions)
      .get("/profile", () => "profile", { permission: false })
      .post("/export", () => "export", { permission: "reports.export" }));
    expect(app.decorator.permissionCatalog.collect(app.routes)).toEqual([
      { code: "reports.export", url: "/export", method: "POST" },
    ]);
    expect(app.decorator.permissionCatalog.permissionFor("GET", "/profile")).toBe(false);
  });

  it("固定 code 配置可选，未匹配时继续自动生成", () => {
    const app = new Elysia().use(permissionGuard({ generateCode: (_, path) => path === "/known" ? "known.read" : null }))
      .get("/known", () => "known")
      .get("/new", () => "new");
    expect(app.decorator.permissionCatalog.collect(app.routes).map((item) => item.code)).toEqual(["known.read", "GET:/new"]);
  });

  it("拒绝含空白的 code 与未明确 method 的 ALL 路由", () => {
    const invalid = new Elysia().use(permissionGuard()).get("/invalid", () => "invalid", { permission: "two words" });
    expect(() => invalid.decorator.permissionCatalog.collect(invalid.routes)).toThrow("code 必须");
    const all = new Elysia().use(permissionGuard()).all("/all", () => "all");
    expect(() => all.decorator.permissionCatalog.collect(all.routes)).toThrow("必须明确 HTTP method");
  });

  it("示例保留固定权限，公共与自助接口不进入目录；应用实例独立", () => {
    const app = createApp();
    const endpoints = app.decorator.permissionCatalog.collect(app.routes);
    expect(endpoints).toHaveLength(41);
    expect(new Set(endpoints.map((item) => item.code)).size).toBe(33);
    expect(endpoints.some((item) => item.url.startsWith("/auth") || item.url.startsWith("/docs") || item.url.startsWith("/health"))).toBe(false);
    expect(endpoints.find((item) => item.url === "/rbac/users/:id/password")?.code).toBe("rbac.user.resetPassword");
    expect(createApp().decorator.permissionCatalog).not.toBe(app.decorator.permissionCatalog);
  });
});
