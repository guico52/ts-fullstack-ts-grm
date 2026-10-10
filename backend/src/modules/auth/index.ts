import { Elysia } from "elysia";
import { jwtPlugin } from "../../plugins/jwt.ts";

import { accessRepository } from "./access.ts";
import { authGuard } from "../../plugins/auth.ts";
import { AuthModel } from "./model.ts";
import { authService } from "./service.ts";

/** 登录、自助改密与当前用户访问集合。 */
export function authModule() {
  return (
    new Elysia({ name: "auth", prefix: "/auth" })
      .use(jwtPlugin())
      .post(
        "/login",
        async ({ body, jwt }) => {
          const user = await authService.login(body);

          // 签发放在**路由层**：authService 不认识 Elysia 上下文，也不该认识。
          const { tokenVersion, ...session } = user;
          const token = await jwt.sign({
            sub: user.id,
            name: user.name,
            email: user.email,
            tokenVersion,
          });
          return { ...session, token };
        },
        {
          body: AuthModel.loginBody,
          response: { 200: AuthModel.loginResult },
          detail: {
            summary: "用邮箱与口令换用户信息与 token",
            tags: ["auth"],
            security: [],
          },
        },
      )
      // authGuard 挂在 login **之后**：它只对之后加入的路由生效，所以登录本身
      // 不需要凭据（否则谁也无法登录）。
      .use(authGuard)
      .get("/me", ({ user }) => authService.profile(user.id), {
        response: { 200: AuthModel.profile },
        detail: { summary: "当前用户资料、所属组织与角色", tags: ["auth"] },
      })
      .post(
        "/me/password",
        ({ user, body }) => authService.changePassword(user.id, body),
        {
          body: AuthModel.changePasswordBody,
          response: { 200: AuthModel.passwordResult },
          detail: {
            summary: "修改自己的密码并使所有旧会话失效",
            tags: ["auth"],
          },
        },
      )
      .get("/me/access", ({ user }) => accessRepository.forUser(user.id), {
        response: { 200: AuthModel.access },
        detail: { summary: "当前用户可访问的视图与权限点", tags: ["auth"] },
      })
  );
}
