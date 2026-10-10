import { Elysia } from "elysia";

import { authRepository } from "../modules/auth/repository.ts";
import { jwtPlugin } from "./jwt.ts";

/** 从 `Authorization: Bearer <token>` 里取出 token，没有就返回 null。 */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}

/**
 * 校验 Bearer token，并把载荷放进 `ctx.user`。
 *
 * 在 app.ts 中挂在业务模块之前，拒绝缺失、无效或过期的 token。
 * /health 与 /auth/login 匿名可访问，/auth/me/access 单独挂载该守卫。
 * 校验通过仅证明身份；permissionGuard 每次查询当前角色权限。
 */
export const authGuard = new Elysia({ name: "auth-guard" })
  .use(jwtPlugin())
  .resolve({ as: "scoped" }, async ({ jwt, headers, status }) => {
    const token = bearerToken(headers.authorization);
    if (!token) {
      return status(401, { message: "缺少凭据", code: "UNAUTHORIZED" });
    }

    const payload = await jwt.verify(token);
    if (!payload) {
      return status(401, { message: "凭据无效或已过期", code: "UNAUTHORIZED" });
    }

    if (
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub) ||
      typeof payload.tokenVersion !== "number" ||
      !Number.isInteger(payload.tokenVersion)
    ) {
      return status(401, { message: "凭据无效或已过期", code: "UNAUTHORIZED" });
    }
    const current = await authRepository.findById(payload.sub);
    if (!current || current.tokenVersion !== payload.tokenVersion) {
      return status(401, {
        message: "会话已失效，请重新登录",
        code: "UNAUTHORIZED",
      });
    }
    return {
      user: {
        id: String(payload.sub),
        name: current.name,
        email: current.email,
        mustChangePassword: current.mustChangePassword,
      },
    };
  });

export type AuthGuardType = typeof authGuard;
