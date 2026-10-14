// ログインを許可するメールアドレス(環境変数 ALLOWED_EMAILS、カンマ区切り)
export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined, raw = process.env.ALLOWED_EMAILS): boolean {
  if (!email) return false;
  return parseAllowedEmails(raw).includes(email.trim().toLowerCase());
}

/**
 * ログインしてよい人か。管理者が scripts/db.mjs user で作った人(app_metadata.allowed)か、ALLOWED_EMAILS にある人。
 * app_metadata は本人が書き換えられないので、勝手に登録した人は通らない
 */
export function isAllowedUser(
  email: string | null | undefined,
  appMetadata: Record<string, unknown> | null | undefined,
  raw = process.env.ALLOWED_EMAILS,
): boolean {
  return appMetadata?.allowed === true || isAllowedEmail(email, raw);
}
