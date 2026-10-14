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

## 人を追加する(将来)

今は `ALLOWED_EMAILS` にメールを足し(Vercelの環境変数も)、その人が一度ログインしてから `npm run db:seed -- <メール>` で習慣を入れる。設定画面からの招待と初回セットアップはSPEC 1.1のとおり未実装。
