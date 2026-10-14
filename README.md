# 日別目標トラッカー

スプレッドシート「大野 日別目標」の習慣・目標管理をWebアプリにしたもの。仕様は [SPEC.md](SPEC.md)。

Next.js(App Router)+ Supabase(PostgreSQL・Auth・RLS)+ Tailwind CSS + Recharts。

## 開発

```bash
npm install
cp .env.example .env.local   # 値を入れる
npm run db:migrate           # テーブルとRLSを作る
npm run dev                  # http://localhost:3001
npm run db:seed -- <メール>   # 初回ログイン後、そのユーザーに習慣リストを入れる
```

| コマンド | 内容 |
| --- | --- |
| `npm test` | `lib/scoring.ts`(点数・連続日数・ご褒美・売上)とインポートの単体テスト |
| `npm run db:migrate` | `supabase/migrations` の未適用SQLを流す(`DATABASE_URL` を使う) |
| `npm run db:seed -- <メール>` | 習慣リスト(SPEC 6.2)を入れる。習慣が既にあれば何もしない |
| `npm run user -- <名前> [メール] [--empty]` | ログイン用の名前とパスワードを決める。メールを付けると新しい人を作る(--empty で習慣なし) |
| `npm run db:test-user` | 開発用テストユーザー(`DEV_TEST_EMAIL`)を作る。`npm run dev` のときだけログイン画面にボタンが出る |
| `node scripts/make-icons.mjs` | PWAのアイコンを作り直す |

## 構成

- `lib/scoring.ts` … 集計はすべてここ(純粋関数)。DBには入力された事実だけを保存し、表示のたびに計算する
- `lib/dates.ts` … 「今日」は必ず `todayInTokyo()`(Asia/Tokyo)
- `lib/store.tsx` … 習慣・✓・日次記録を一度読み込んで画面間で共有。✓は先に画面へ反映し、保存に失敗したら元に戻して知らせる
- `lib/import/` … スプレッドシートのCSVの読み取り(`sheets.ts`)と保存(`apply.ts`)
- `proxy.ts` … 未ログインならログイン画面へ。`ALLOWED_EMAILS` に無いメールはログアウトさせる
- `supabase/migrations/` … 全テーブルに `user_id` とRLS(自分の行だけ読み書き)

SPECからの追加:`habits.active_from`(満点に数え始める日)。インポートで過去の日を取り込むと、取り込んだ最初の日に前倒しする。優先度の履歴(`habit_versions`)はDBのトリガーで自動記録する。

## 公開(Vercel)

環境変数は `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`ALLOWED_EMAILS`、`NEXT_PUBLIC_GOOGLE_LOGIN` の4つ。`DATABASE_URL` と `DEV_TEST_*` は入れない。

公開後、Supabase の Authentication → URL Configuration で Site URL を本番URLにし、Redirect URLs に `https://<本番URL>/**` を足す。

## ログインと人の追加

ログインは「名前とパスワード」。名前とパスワードは管理者が決めて、使う人に伝える(本人は設定 → アカウントで変更できる)。パスワードを忘れたときは、ログイン画面の下からメールのコードでも入れる。

```bash
# 既にいる人の名前・パスワードを決め直す(パスワードは画面に出ない入力で聞かれる)
node --env-file=.env.local scripts/db.mjs user <名前>
# 新しい人を作る(習慣リストも入る。空から始めるときは --empty)
node --env-file=.env.local scripts/db.mjs user <名前> <メール> [--empty]
```

このコマンドで作った人は `app_metadata.allowed` が付くので、`ALLOWED_EMAILS` に足さなくてもログインできる(本人は app_metadata を書き換えられない)。メールが無い人は `<名前>@daily-goal.local` のような届かないアドレスで作る。その人は「パスワードを忘れたとき」のメールが使えないので、パスワードはこのコマンドで決め直す。
