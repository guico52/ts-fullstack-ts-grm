import { t, type UnwrapSchema } from "elysia";

const id = t.String({ pattern: "^\\d+$" });
const email = t.String({ minLength: 3, maxLength: 255, pattern: "^\\S+@\\S+$" });
const password = t.String({ minLength: 6, maxLength: 128 });

/**
 * 登录只要两样东西，返回的也只有用户本人。
 *
 * **没有 token、没有会话**：这一版只做到"凭据对不对"，发凭据和后续请求的
 * 校验都还没做（见 docs/constraints.md 的说明）。所以响应体里也不该出现
 * 任何让人以为拿到了凭据的字段。
 */
const session = t.Object({ id, name: t.String(), email: t.String() });

export const AuthModel = {
  loginBody: t.Object({ email, password }, { additionalProperties: false }),
  session,
} as const;

export type AuthModel = {
  [K in keyof typeof AuthModel]: UnwrapSchema<(typeof AuthModel)[K]>;
};
