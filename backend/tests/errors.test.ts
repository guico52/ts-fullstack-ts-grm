import { describe, expect, it } from "bun:test";
import {
  classifyDatabaseError,
  DatabaseAuthError,
  DatabaseConflictError,
  DatabaseReferenceError,
  DatabaseUnavailableError,
} from "../src/errors.ts";

describe("classifyDatabaseError", () => {
  it("把认证失败码映射为 DatabaseAuthError", () => {
    expect(classifyDatabaseError({ code: "28P01" })).toBeInstanceOf(DatabaseAuthError);
    expect(classifyDatabaseError({ code: "28000" })).toBeInstanceOf(DatabaseAuthError);
  });

  it("把唯一约束冲突映射为 DatabaseConflictError", () => {
    expect(classifyDatabaseError({ code: "23505" })).toBeInstanceOf(DatabaseConflictError);
  });

  it("把外键冲突映射为 DatabaseReferenceError", () => {
    expect(classifyDatabaseError({ code: "23503" })).toBeInstanceOf(DatabaseReferenceError);
  });

  it("把连接类故障映射为 DatabaseUnavailableError", () => {
    for (const code of ["ECONNREFUSED", "ETIMEDOUT", "57P01", "53300"]) {
      expect(classifyDatabaseError({ code })).toBeInstanceOf(DatabaseUnavailableError);
    }
    expect(
      classifyDatabaseError(new Error("Connection terminated unexpectedly")),
    ).toBeInstanceOf(DatabaseUnavailableError);
  });

  it("保留原始 cause", () => {
    const cause = { code: "23505" };
    const classified = classifyDatabaseError(cause) as DatabaseConflictError;
    expect(classified.cause).toBe(cause);
  });

  it("认不出的错误原样返回", () => {
    const original = new Error("boom");
    expect(classifyDatabaseError(original)).toBe(original);
    expect(classifyDatabaseError({ code: "XX000" })).toMatchObject({ code: "XX000" });
  });

  it("对非对象输入安全返回", () => {
    expect(classifyDatabaseError(undefined)).toBeUndefined();
    expect(classifyDatabaseError("nope")).toBe("nope");
  });
});
