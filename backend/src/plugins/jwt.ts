import { jwt } from "@elysiajs/jwt";
import { JWT_EXPIRES_IN, resolveJwtSecret } from "./jwt-secret.ts";

/** 签发与校验共用 JWT 配置。 */
export function jwtPlugin() {
  return jwt({ name: "jwt", secret: resolveJwtSecret(), exp: JWT_EXPIRES_IN });
}
