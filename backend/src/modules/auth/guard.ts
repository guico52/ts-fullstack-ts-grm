import { Elysia } from "elysia";

import { jwtPlugin } from "./index.ts";

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
 * **目前没有挂在任何业务路由上。** 挂上去会立刻打断前端 —— 前端还没有把 token
 * 放进请求头。要启用时，在 `app.ts` 里把 `.use(authGuard)` 写在业务模块
 * **之前**（Elysia 的生命周期钩子只对之后加入的路由生效，onError 的注释里
 * 有同样的坑）。
 *
 * 校验通过后 `user` 是 token 的载荷（`sub` / `name` / `email`）。它只说明
 * **这枚 token 是本服务签发的、且没过期**，不代表这个人现在还有权限 ——
 * 授权是另一件事，还没有做。
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

    return {
      user: {
        id: String(payload.sub),
        name: payload.name,
        email: payload.email,
      },
    };
  });
