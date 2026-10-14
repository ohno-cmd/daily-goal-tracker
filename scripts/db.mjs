// データベースの管理用。.env.local の DATABASE_URL(Supabase の Session pooler 接続文字列)を使う。
//   npm run db:migrate          supabase/migrations の未適用のSQLを順に流す
//   npm run db:seed -- <メール>  そのユーザーに習慣リスト(SPEC 6.2)を入れる。省略時は ALLOWED_EMAILS の1件目
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL が .env.local にありません。");
    process.exit(1);
  }
  return new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

async function migrate(db) {
  await db.query(`create schema if not exists app_meta;
    create table if not exists app_meta.migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query("select name from app_meta.migrations")).rows.map((r) => r.name));
  const dir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    try {
      await db.query("begin");
      await db.query(sql);
      await db.query("insert into app_meta.migrations (name) values ($1)", [f]);
      await db.query("commit");
      console.log(`適用: ${f}`);
      applied++;
    } catch (e) {
      await db.query("rollback");
      console.error(`失敗: ${f}\n${e.message}`);
      process.exit(1);
    }
  }
  console.log(applied ? `${applied}件のマイグレーションを適用しました。` : "すべて適用済みです。");
}

async function seed(db, email) {
  email = (email || (process.env.ALLOWED_EMAILS || "").split(",")[0] || "").trim().toLowerCase();
  if (!email) {
    console.error("メールアドレスを指定してください。");
    process.exit(1);
  }
  const user = (await db.query("select id from auth.users where lower(email) = $1", [email])).rows[0];
  if (!user) {
    console.error(`${email} のユーザーがまだいません。先にアプリで一度ログインしてください。`);
    process.exit(1);
  }
  await db.query("insert into public.profiles (user_id) values ($1) on conflict (user_id) do nothing", [user.id]);
  const count = Number((await db.query("select count(*) from public.habits where user_id = $1", [user.id])).rows[0].count);
  if (count > 0) {
    console.log(`${email} には習慣が${count}件あるため、何もしませんでした。`);
    return;
  }
  const habits = JSON.parse(fs.readFileSync(path.join(root, "supabase", "seed", "habits.json"), "utf8"));
  await db.query("begin");
  for (const [i, h] of habits.entries()) {
    await db.query(
      `insert into public.habits (user_id, time_slot, time_label, name, priority, pillar_label, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, h.time_slot, h.time_label, h.name, h.priority, h.pillar_label, (i + 1) * 10],
    );
  }
  await db.query("commit");
  console.log(`${email} に習慣を${habits.length}件入れました。`);
}

const [cmd, arg] = process.argv.slice(2);
const db = connect();
await db.connect();
try {
  if (cmd === "migrate") await migrate(db);
  else if (cmd === "seed") await seed(db, arg);
  else console.error("使い方: node scripts/db.mjs migrate | seed [メール]");
} finally {
  await db.end();
}
