import { t, type UnwrapSchema } from "elysia";

const id = t.String({ pattern: "^\\d+$" });
const email = t.String({
  minLength: 3,
  maxLength: 255,
  pattern: "^\\S+@\\S+$",
});
const password = t.String({ minLength: 6, maxLength: 128 });

/** 用户本人。**不含任何凭据** —— 口令哈希和 token 都不在这里。 */
const session = t.Object({
  id,
  name: t.String(),
  email: t.String(),
  mustChangePassword: t.Boolean(),
});

/**
 * 登录响应 = 用户本人 + 改密状态 + 一枚 token。
 *
 * 字段是**扁平**的（不是 `{ user, token }`）：登录页拿到响应后直接把
 * `id/name/email` 交给 store，多一层嵌套只会让那一处多一次解构。
 */
const loginResult = t.Object({
  id,
  name: t.String(),
  email: t.String(),
  mustChangePassword: t.Boolean(),
  token: t.String(),
});

/** 写进 token 的载荷。`sub` 是用户 id，其余两个只是为了调试时看得懂。 */
const tokenPayload = t.Object({
  sub: id,
  name: t.String(),
  email: t.String(),
  tokenVersion: t.Integer({ minimum: 0 }),
});

/** 一个可访问的视图。`path` / `componentName` 对菜单和按钮为空。 */
const accessView = t.Object({
  id,
  name: t.String(),
  icon: t.String(),
  path: t.Union([t.String(), t.Null()]),
  componentPath: t.Union([t.String(), t.Null()]),
  componentName: t.Union([t.String(), t.Null()]),
  type: t.String(),
  parentId: t.Union([id, t.Null()]),
  sort: t.Number(),
});

/** 当前用户能做什么：能到达的视图，以及握在手里的权限点。 */
const access = t.Object({
  views: t.Array(accessView),
  permissions: t.Array(t.String()),
});

export const AuthModel = {
  loginBody: t.Object({ email, password }, { additionalProperties: false }),
  changePasswordBody: t.Object(
    { currentPassword: password, newPassword: password },
    { additionalProperties: false },
  ),
  passwordResult: t.Object({ changed: t.Literal(true) }),
  profile: t.Object({
    id, name: t.String(), email: t.String(), mustChangePassword: t.Boolean(),
    organization: t.Union([t.Object({ id, name: t.String() }), t.Null()]),
    roles: t.Array(t.Object({ id, name: t.String() })),
  }),
  session,
  loginResult,
  tokenPayload,
  access,
} as const;

export type AuthModel = {
  [K in keyof typeof AuthModel]: UnwrapSchema<(typeof AuthModel)[K]>;
};
