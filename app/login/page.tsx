import { Suspense } from "react";
import { supabaseConfigured } from "@/lib/supabase/env";
import { devLogin } from "./actions";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  not_allowed: "このメールアドレスではログインできません。",
  callback: "ログインに失敗しました。もう一度お試しください。",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">日別目標トラッカー</h1>
      <p className="mb-8 text-sm text-zinc-500">自分で決めた名前とパスワードでログインします。</p>
      {supabaseConfigured ? (
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Supabaseの接続情報が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          を入れて、開発サーバーを再起動してください。
        </p>
      )}
      {process.env.NODE_ENV === "development" && process.env.DEV_TEST_EMAIL && (
        <form action={devLogin} className="mt-10 border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-700">
          <button className="min-h-11 w-full rounded-xl text-sm text-zinc-500 underline">
            開発用:テストユーザー({process.env.DEV_TEST_EMAIL})でログイン
          </button>
        </form>
      )}
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  return (
    <LoginForm
      googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true"}
      initialError={typeof error === "string" ? ERRORS[error] : undefined}
    />
  );
}
