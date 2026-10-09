import { Elysia } from "elysia";
import { AuthModel } from "./model.ts";
import { authService } from "./service.ts";

/**
 * 登录。
 *
 * 这个域只有一实体，所以不再套一层 `auth/<实体>/` —— 域聚合层是为"一个域
 * 有多个 controller"准备的，这里只有一个。
 *
 * 前缀直接是 `/auth`，路由是 `POST /auth/login`。**没有登出接口**：
 * 服务端还没有会话可清，登出在前端把本地状态丢掉就够了（见 stores/auth.ts）。
 */
export function authModule() {
  return new Elysia({ name: "auth", prefix: "/auth" })
    .post("/login", ({ body }) => authService.login(body), {
      body: AuthModel.loginBody,
      response: { 200: AuthModel.session },
      detail: { summary: "用邮箱与口令登录", tags: ["auth"] },
    });
}
