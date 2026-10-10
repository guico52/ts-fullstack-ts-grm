/** 领域层「资源不存在」。service 抛出，由 app.ts 映射为 404。 */
export class ResourceNotFoundError extends Error {}

/**
 * 领域层「层级不合法」。视图是严格的三层：菜单 → 页面 → 按钮，
 * 把页面挂在页面上（或让菜单有上级）都是配置错误，由 app.ts 映射为 422。
 */
export class InvalidHierarchyError extends Error {}

/**
 * 领域层「凭据不对」。邮箱不在、口令不匹配都抛这个。
 *
 * **两种失败不分开报**：告诉调用方「邮箱存在但口令不对」等于把账号是否存在
 * 送了出去。由 app.ts 映射为 401。
 */
export class InvalidCredentialsError extends Error {}

/** 当前口令错误属于表单错误，不应触发会话过期处理。 */
export class InvalidPasswordError extends Error {}

export class DatabaseUnavailableError extends Error {}
export class DatabaseAuthError extends Error {}
export class DatabaseConflictError extends Error {}
export class DatabaseReferenceError extends Error {}

/**
 * 把 pg 驱动的错误码翻译成领域可识别的错误类型，让 app.ts 不必认识 SQLSTATE。
 * 认不出的错误原样返回，由全局兜底逻辑按 500 处理。
 *
 * 参考：https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export function classifyDatabaseError<T>(error: T): T | DatabaseUnavailableError | DatabaseAuthError | DatabaseConflictError | DatabaseReferenceError {
  if (typeof error !== "object" || error === null) return error;
  const code = "code" in error ? error.code : undefined;
  const options = { cause: error };
  if (code === "28P01" || code === "28000") {
    return new DatabaseAuthError("数据库凭据无效", options);
  }
  if (code === "23505") return new DatabaseConflictError("资源已存在", options);
  if (code === "23503") {
    return new DatabaseReferenceError("关联资源不存在或仍被使用", options);
  }
  if (
    ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "57P01", "57P02", "57P03", "53300"].includes(String(code)) ||
    (error instanceof Error && /Connection terminated|connection timeout|timeout exceeded when trying to connect/i.test(error.message))
  ) {
    return new DatabaseUnavailableError("数据库暂时不可用", options);
  }
  return error;
}
