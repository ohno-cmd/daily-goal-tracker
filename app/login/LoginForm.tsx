"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendCode, verifyCode, type LoginState } from "./actions";

const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900";
const button =
  "flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-3 font-semibold disabled:opacity-50";

export function LoginForm({ googleEnabled, initialError }: { googleEnabled: boolean; initialError?: string }) {
  const [sent, send, sending] = useActionState(sendCode, { step: "email", email: "", error: initialError } as LoginState);
  const [verified, verify, verifying] = useActionState(verifyCode, { step: "code", email: "" } as LoginState);
  const [googleError, setGoogleError] = useState<string>();
  const state = verified.error ? { ...sent, ...verified, info: undefined } : sent;

  async function google() {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setGoogleError(error.message);
  }

  return (
    <div className="space-y-6">
      {sent.step === "email" ? (
        <form action={send} className="space-y-3">
          <label className="block text-sm text-zinc-600 dark:text-zinc-400" htmlFor="email">
            メールアドレス
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={sent.email} className={input} />
          <button disabled={sending} className={`${button} bg-emerald-600 text-white`}>
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
          <button disabled={verifying} className={`${button} bg-emerald-600 text-white`}>
            {verifying ? "確認中…" : "ログイン"}
          </button>
          <button type="button" onClick={() => location.reload()} className="w-full text-sm text-zinc-500 underline">
            メールアドレスを入れ直す
          </button>
        </form>
      )}

      {state.info && <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.info}</p>}
      {(state.error || googleError) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error || googleError}
        </p>
      )}

      {googleEnabled && (
        <>
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
        </>
      )}
    </div>
  );
}
