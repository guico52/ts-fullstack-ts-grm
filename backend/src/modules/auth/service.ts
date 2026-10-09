import { InvalidCredentialsError } from "../../errors.ts";
import type { AuthModel } from "./model.ts";
import { authRepository } from "./repository.ts";

export const authService = {
  /**
   * 邮箱不存在与口令不匹配抛**同一个**错误。
   *
   * 分开报会把"这个邮箱注册过"送给任何人，而登录接口是匿名可调的。
   * 调用方需要的只是"没进去"，不是"为什么没进去"。
   */
  async login(body: AuthModel["loginBody"]): Promise<AuthModel["session"]> {
    const found = await authRepository.findByEmail(body.email);
    if (!found) throw new InvalidCredentialsError("邮箱或口令不正确");

    const ok = await Bun.password.verify(body.password, found.pwdHash);
    if (!ok) throw new InvalidCredentialsError("邮箱或口令不正确");

    // 只回这三个字段：哈希留在服务端。
    return { id: found.id, name: found.name, email: found.email };
  },
};
