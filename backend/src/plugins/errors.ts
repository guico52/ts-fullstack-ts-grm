import { Elysia } from "elysia";
import {
  DatabaseAuthError,
  DatabaseConflictError,
  DatabaseReferenceError,
  DatabaseUnavailableError,
  InvalidCredentialsError,
  InvalidHierarchyError,
  InvalidPasswordError,
  ResourceNotFoundError,
} from "../errors.ts";

export function errorPlugin() {
  return new Elysia({ name: "application-errors" })
    .onError({ as: "global" }, ({ code, error, set }) => {
      if (code === "VALIDATION") {
        set.status = 422;
        return { message: "请求参数不合法", code };
      }
      if (code === "NOT_FOUND" || error instanceof ResourceNotFoundError) {
        set.status = 404;
        return {
          message: error instanceof Error ? error.message : "接口不存在",
          code: "NOT_FOUND",
        };
      }
      // A malformed tree is the caller's mistake, not a server fault.
      if (error instanceof InvalidHierarchyError) {
        set.status = 422;
        return { message: error.message, code: "INVALID_HIERARCHY" };
      }
      if (error instanceof InvalidPasswordError) {
        set.status = 422;
        return { message: error.message, code: "INVALID_PASSWORD" };
      }
      // 凭据不对：匿名可调的接口，所以只回答“没进去”，不回答“为什么”。
      if (error instanceof InvalidCredentialsError) {
        set.status = 401;
        return { message: error.message, code: "INVALID_CREDENTIALS" };
      }
      // 凭据被拒是配置错误，重试不会成功，必须和"暂时连不上"区分开。
      if (error instanceof DatabaseAuthError) {
        set.status = 500;
        console.error("PostgreSQL 认证失败：", error.message);
        return { message: "数据库凭据无效", code: "DATABASE_AUTH_FAILED" };
      }
      if (error instanceof DatabaseUnavailableError) {
        set.status = 503;
        console.error("PostgreSQL 连接失败：", error.message);
        return { message: "数据库暂时不可用", code: "DATABASE_UNAVAILABLE" };
      }
      if (error instanceof DatabaseConflictError) {
        set.status = 409;
        return { message: error.message, code: "CONFLICT" };
      }
      if (error instanceof DatabaseReferenceError) {
        set.status = 422;
        return { message: error.message, code: "INVALID_REFERENCE" };
      }

      set.status = 500;
      console.error("未处理的错误：", error);
      return { message: "服务器内部错误", code };
    });
}
