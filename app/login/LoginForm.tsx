"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordLogin, sendCode, verifyCode, type LoginState, type PasswordState } from "./actions";

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-purple-500 dark:border-zinc-700 dark:bg-zinc-900";
const button =
  "flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-3 font-semibold disabled:opacity-50";

export function LoginForm({ googleEnabled, initialError }: { googleEnabled: boolean; initialError?: string }) {
  const [mode, setMode] = useState<"password" | "email">("password");
  return (
    <div className="space-y-6">
      {mode === "password" ? <PasswordForm initialError={initialError} /> : <EmailCodeForm googleEnabled={false} initialError={initialError} />}
      <button type="button" onClick={() => setMode(mode === "password" ? "email" : "password")} className="min-h-11 w-full text-sm text-zinc-500 underline">
        {mode === "password" ? "パスワードを忘れたとき(メールのコードでログイン)" : "名前とパスワードでログイン"}
      </button>
      {googleEnabled && <GoogleButton />}
    </div>
  );
}

/** 名前とパスワード */
function PasswordForm({ initialError }: { initialError?: string }) {
  const [state, login, pending] = useActionState(passwordLogin, { name: "", error: initialError } as PasswordState);
  return (
    <form action={login} className="space-y-3">
      <label className="block text-sm text-zinc-600 dark:text-zinc-400" htmlFor="name">
        名前
      </label>
      <input id="name" name="name" autoComplete="username" autoCapitalize="none" required defaultValue={state.name} className={input} />
      <label className="block text-sm text-zinc-600 dark:text-zinc-400" htmlFor="password">
        パスワード
      </label>
      <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
      <button disabled={pending} className={`${button} bg-purple-600 text-white`}>
        {pending ? "確認中…" : "ログイン"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** メールに届くコード(パスワードを忘れたとき) */
function EmailCodeForm({ googleEnabled, initialError }: { googleEnabled: boolean; initialError?: string }) {
  const [sent, send, sending] = useActionState(sendCode, { step: "email", email: "", error: initialError } as LoginState);
  const [verified, verify, verifying] = useActionState(verifyCode, { step: "code", email: "" } as LoginState);
  const state = verified.error ? { ...sent, ...verified, info: undefined } : sent;

  return (
    <div className="space-y-6">
      {sent.step === "email" ? (
        <form action={send} className="space-y-3">
          <label className="block text-sm text-zinc-600 dark:text-zinc-400" htmlFor="email">
            メールアドレス
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={sent.email} className={input} />
          <button disabled={sending} className={`${button} bg-purple-600 text-white`}>
            {sending ? "送信中…" : "ログイン用のメールを送る"}
          </button>
        </form>
      ) : (
        <form action={verify} className="space-y-3">
          <input type="hidden" name="email" value={sent.email} />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{sent.email}</p>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400" htmlFor="code">
            メールに書かれたコード
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className={`${input} text-center text-2xl tracking-[0.4em]`}
          />
          <button disabled={verifying} className={`${button} bg-purple-600 text-white`}>
            {verifying ? "確認中…" : "ログイン"}
          </button>
          <button type="button" onClick={() => location.reload()} className="w-full text-sm text-zinc-500 underline">
            メールアドレスを入れ直す
          </button>
        </form>
      )}

      {state.info && <p className="text-sm text-purple-700 dark:text-purple-400">{state.info}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {googleEnabled && <GoogleButton />}
    </div>
  );
}

function GoogleButton() {
  const [error, setError] = useState<string>();
  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            または
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <button
            type="button"
            onClick={google}
            className={`${button} border border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100`}
          >
            Googleでログイン
          </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
