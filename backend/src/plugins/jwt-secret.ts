/**
 * JWT 密钥。
 *
 * 生产环境**必须**通过环境变量注入：用一个公开的默认值签发凭据，等于谁都能
 * 伪造 token。开发环境允许缺省，但会把这件事说出来——静默使用一个弱默认值
 * 是那种"上线前才想起来"的问题里最难想起来的一种。
 */
const DEV_SECRET = "ts-fullstack-ts-grm-dev-secret-do-not-use-in-production";

export function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;

  if ((process.env.NODE_ENV ?? "development") === "production") {
    throw new Error("生产环境必须配置 JWT_SECRET，否则任何人都能伪造 token");
  }

  console.warn("未配置 JWT_SECRET，正在使用开发默认值（仅限本地）。");
  return DEV_SECRET;
}

/** token 有效期。放在一处，签发与文档都读它。 */
export const JWT_EXPIRES_IN = "7d";
