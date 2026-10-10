import { describe, expect, it } from "bun:test";
import { bearerToken } from "../src/plugins/auth.ts";

describe("Bearer 头的解析", () => {
  it("取出 token", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("scheme 大小写不敏感 —— 规范要求如此", () => {
    expect(bearerToken("bearer abc")).toBe("abc");
    expect(bearerToken("BEARER abc")).toBe("abc");
  });

  it("缺头、缺值、换 scheme 都返回 null", () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer ")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    // 只有 scheme 没有分隔符
    expect(bearerToken("Bearerabc")).toBeNull();
  });

  it("token 里出现空格时只取第一段 —— 分隔与取值都按规范来", () => {
    // Authorization 的值按第一个空格切分，多出来的部分不是 token 的一部分。
    expect(bearerToken("Bearer abc def")).toBe("abc");
  });
});

import { permissionFor } from "../src/plugins/permission-codes.ts";
describe("示例固定权限配置", () => {
  it("重置接口绑定独立 code；新接口无需登记", () => {
    expect(permissionFor("POST", "/rbac/users/:id/password")).toBe("rbac.user.resetPassword");
    expect(permissionFor("POST", "/rbac/users/:id/password/")).toBe("rbac.user.resetPassword");
    expect(permissionFor("POST", "/rbac/users")).toBe("rbac.user.create");
    expect(permissionFor("PATCH", "/rbac/users/:id")).toBe("rbac.user.update");
    expect(permissionFor("GET", "/book/books/export")).toBeNull();
    expect(permissionFor("POST", "/rbac/users/:id/archive")).toBeNull();
  });
});
