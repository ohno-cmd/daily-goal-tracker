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
  if (error) return { step: "email", email, error: `送信できませんでした:${error.message}` };
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

/** 開発用テストユーザーでログインする(npm run dev のときだけ) */
export async function devLogin(): Promise<void> {
  const email = process.env.DEV_TEST_EMAIL;
  const password = process.env.DEV_TEST_PASSWORD;
  if (process.env.NODE_ENV !== "development" || !email || !password || !isAllowedEmail(email)) redirect("/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  redirect(error ? "/login?error=callback" : "/");
}
