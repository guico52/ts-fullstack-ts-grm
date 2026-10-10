/** @see https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature */
export function validatePassword(
  newPassword: string,
  confirmation: string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (newPassword.length < 6 || newPassword.length > 128)
    errors.newPassword = "密码必须为 6–128 个字符。"
  if (confirmation !== newPassword || confirmation === "")
    errors.confirmation = "两次输入的密码不一致。"
  return errors
}
