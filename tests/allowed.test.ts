import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowedEmails } from "@/lib/auth/allowed";

describe("ALLOWED_EMAILS", () => {
  it("カンマ区切り・空白・大文字小文字を吸収する", () => {
    expect(parseAllowedEmails(" A@example.com, b@example.com ,")).toEqual(["a@example.com", "b@example.com"]);
  });
  it("登録したメールだけ許可する", () => {
    const raw = "me@example.com";
    expect(isAllowedEmail("Me@Example.com", raw)).toBe(true);
    expect(isAllowedEmail("other@example.com", raw)).toBe(false);
    expect(isAllowedEmail(undefined, raw)).toBe(false);
    expect(isAllowedEmail("me@example.com", "")).toBe(false);
  });
});
