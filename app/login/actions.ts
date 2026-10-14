"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email: string; error?: string; info?: string };

const NOT_ALLOWED = "このメールアドレスではログインできません。";

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { step: "email", email, error: "メールアドレスを入力してください。" };
  if (!isAllowedEmail(email)) return { step: "email", email, error: NOT_ALLOWED };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    // Supabase標準のメール送信は1時間に数通まで
    const msg = /rate limit/i.test(error.message)
      ? "メールの送信回数の上限に達しました。1時間ほど待ってから、もう一度お試しください。"
      : `送信できませんでした:${error.message}`;
    return { step: "email", email, error: msg };
  }
  return { step: "code", email, info: "メールを送りました。届いたコードを入力するか、メールのリンクを開いてください。" };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!isAllowedEmail(email)) return { step: "email", email, error: NOT_ALLOWED };
  if (!token) return { step: "code", email, error: "コードを入力してください。" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "コードが違うか、期限が切れています。" };
  redirect("/");
}

export type PasswordState = { name: string; error?: string };

const WRONG = "名前かパスワードが違います。";

/** 名前とパスワードでログインする。名前から本人のメールを引き、そのメールとパスワードで認証する */
export async function passwordLogin(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!name || !password) return { name, error: "名前とパスワードを入力してください。" };

  const supabase = await createClient();
  const { data: email } = await supabase.rpc("email_for_login", { p_username: name });
  if (typeof email !== "string" || !isAllowedEmail(email)) return { name, error: WRONG };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { name, error: /rate limit/i.test(error.message) ? "試行回数が多すぎます。少し待ってからお試しください。" : WRONG };
  redirect("/");
}

/** 開発用テストユーザーでログインする(npm run dev のときだけ) */
export async function devLogin(): Promise<void> {
  const email = process.env.DEV_TEST_EMAIL;
  const password = process.env.DEV_TEST_PASSWORD;
  if (process.env.NODE_ENV !== "development" || !email || !password || !isAllowedEmail(email)) redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  redirect(error ? "/login?error=callback" : "/");
}
