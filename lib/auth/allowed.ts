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
