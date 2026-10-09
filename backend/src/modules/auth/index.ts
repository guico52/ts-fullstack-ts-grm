import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";

import { AuthModel } from "./model.ts";
import { JWT_EXPIRES_IN, resolveJwtSecret } from "./secret.ts";
import { authService } from "./service.ts";

/** JWT 插件。签发与校验共用同一份密钥配置，所以只有这一处构造它。 */
export function jwtPlugin() {
  return jwt({ name: "jwt", secret: resolveJwtSecret(), exp: JWT_EXPIRES_IN });
}

/**
 * 登录。
 *
 * 这个域只有一实体，所以不再套一层 `auth/<实体>/` —— 域聚合层是为“一个域
 * 有多个 controller”准备的，这里只有一个。
 *
 * 前缀直接是 `/auth`，路由是 `POST /auth/login`。**没有登出接口**：token 是
 * 自证的，服务端没有会话可清，登出就是前端把本地那份丢掉。
 */
export function authModule() {
  return new Elysia({ name: "auth", prefix: "/auth" })
    .use(jwtPlugin())
    .post("/login", async ({ body, jwt }) => {
      const user = await authService.login(body);

      // 签发放在**路由层**：authService 不认识 Elysia 上下文，也不该认识。
      const token = await jwt.sign({ sub: user.id, name: user.name, email: user.email });

      return { ...user, token };
    }, {
      body: AuthModel.loginBody,
      response: { 200: AuthModel.loginResult },
      detail: { summary: "用邮箱与口令换用户信息与 token", tags: ["auth"] },
    });
}
