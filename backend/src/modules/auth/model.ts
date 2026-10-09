import { t, type UnwrapSchema } from "elysia";

const id = t.String({ pattern: "^\\d+$" });
const email = t.String({ minLength: 3, maxLength: 255, pattern: "^\\S+@\\S+$" });
const password = t.String({ minLength: 6, maxLength: 128 });

/**
 * 登录只要两样东西，返回的也只有用户本人加一枚 token。
 *
 * token 是**自证的**：服务端不存会话，所以没有登出接口——登出就是前端把
 * 本地那份丢掉。（代价是被偷走的 token 一直有效到过期；要撤销得靠黑名单。）
 */
/** 用户本人。**不含任何凭据** —— 口令哈希和 token 都不在这里。 */
const session = t.Object({ id, name: t.String(), email: t.String() });

/**
 * 登录响应 = 用户本人 + 一枚 token。
 *
 * 字段是**扁平**的（不是 `{ user, token }`）：登录页拿到响应后直接把
 * `id/name/email` 交给 store，多一层嵌套只会让那一处多一次解构。
 */
const loginResult = t.Object({ id, name: t.String(), email: t.String(), token: t.String() });

/** 写进 token 的载荷。`sub` 是用户 id，其余两个只是为了调试时看得懂。 */
const tokenPayload = t.Object({ sub: id, name: t.String(), email: t.String() });

export const AuthModel = {
  loginBody: t.Object({ email, password }, { additionalProperties: false }),
  session,
  loginResult,
  tokenPayload,
} as const;

export type AuthModel = {
  [K in keyof typeof AuthModel]: UnwrapSchema<(typeof AuthModel)[K]>;
};
