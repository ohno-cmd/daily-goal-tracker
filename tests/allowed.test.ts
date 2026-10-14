import { describe, expect, it } from "vitest";
import { isAllowedEmail, isAllowedUser, parseAllowedEmails } from "@/lib/auth/allowed";

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
  it("管理者が作った人(app_metadata.allowed)は ALLOWED_EMAILS に無くても通る", () => {
    expect(isAllowedUser("yuri@daily-goal.local", { allowed: true }, "me@example.com")).toBe(true);
    expect(isAllowedUser("someone@example.com", {}, "me@example.com")).toBe(false);
    expect(isAllowedUser("someone@example.com", { allowed: "true" }, "me@example.com")).toBe(false);
    expect(isAllowedUser("me@example.com", undefined, "me@example.com")).toBe(true);
  });
});
