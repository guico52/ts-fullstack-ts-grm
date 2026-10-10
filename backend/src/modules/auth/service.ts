import {
  InvalidCredentialsError,
  InvalidPasswordError,
  ResourceNotFoundError,
} from "../../errors.ts";
import type { AuthModel } from "./model.ts";
import { authRepository } from "./repository.ts";

export const authService = {
  async profile(id: string) {
    const profile = await authRepository.profile(id);
    if (!profile) throw new InvalidCredentialsError("会话已失效");
    return profile;
  },
  // @see https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature
  async changePassword(id: string, body: AuthModel["changePasswordBody"]) {
    const found = await authRepository.findById(id);
    if (!found) throw new InvalidCredentialsError("会话已失效");
    if (!(await Bun.password.verify(body.currentPassword, found.pwdHash))) {
      throw new InvalidPasswordError("当前密码不正确");
    }
    if (body.currentPassword === body.newPassword)
      throw new InvalidPasswordError("新密码必须与当前密码不同");
    const hash = await Bun.password.hash(body.newPassword);
    if (
      !(await authRepository.replacePassword(
        id,
        hash,
        false,
        found.tokenVersion,
      ))
    ) {
      throw new InvalidCredentialsError("会话已失效，请重新登录");
    }
    return { changed: true as const };
  },
  async resetPassword(id: string, password: string, actorId: string) {
    const hash = await Bun.password.hash(password);
    if (!(await authRepository.replacePassword(id, hash, true)))
      throw new ResourceNotFoundError("用户不存在");
    console.info(
      JSON.stringify({ event: "password_reset", actorId, userId: id }),
    );
    return { changed: true as const };
  },
  /**
   * 邮箱不存在与口令不匹配抛**同一个**错误。
   *
   * 分开报会把"这个邮箱注册过"送给任何人，而登录接口是匿名可调的。
   * 调用方需要的只是"没进去"，不是"为什么没进去"。
   */
  async login(
    body: AuthModel["loginBody"],
  ): Promise<AuthModel["session"] & { tokenVersion: number }> {
    const found = await authRepository.findByEmail(body.email);
    if (!found) throw new InvalidCredentialsError("邮箱或口令不正确");

    const ok = await Bun.password.verify(body.password, found.pwdHash);
    if (!ok) throw new InvalidCredentialsError("邮箱或口令不正确");

    // 内部返回版本供路由签发；响应剔除版本，哈希始终留在服务端。
    return {
      id: found.id,
      name: found.name,
      email: found.email,
      tokenVersion: found.tokenVersion,
      mustChangePassword: found.mustChangePassword,
    };
  },
};
