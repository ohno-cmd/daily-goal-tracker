// データベースの管理用。.env.local の DATABASE_URL(Supabase の Session pooler 接続文字列)を使う。
//   npm run db:migrate          supabase/migrations の未適用のSQLを順に流す
//   npm run db:seed -- <メール>  そのユーザーに習慣リスト(SPEC 6.2)を入れる。省略時は ALLOWED_EMAILS の1件目
//   npm run user -- <名前> [メール] ログイン用の名前とパスワードを決める(無ければ人を作る)
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
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

// 開発用のテストユーザー(DEV_TEST_EMAIL / DEV_TEST_PASSWORD)を作り、習慣を入れる。
// 本人のデータを触らずに画面を確かめるためと、RLSで本人のデータが見えないことの確認に使う
async function testUser(db) {
  const email = (process.env.DEV_TEST_EMAIL || "").trim().toLowerCase();
  const password = process.env.DEV_TEST_PASSWORD || "";
  if (!email || password.length < 12) {
    console.error("DEV_TEST_EMAIL と DEV_TEST_PASSWORD(12文字以上)を .env.local に入れてください。");
    process.exit(1);
  }
  const found = (await db.query("select id from auth.users where lower(email) = $1", [email])).rows[0];
  if (found) {
    await db.query("update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1", [found.id, password]);
    console.log(`${email} は作成済みです(パスワードを .env.local の値に合わせました)。`);
  } else {
    await createAuthUser(db, email, password);
    console.log(`${email} を作りました。`);
  }
  await seed(db, email);
}

/** メール確認済みのユーザーを作り、idを返す */
async function createAuthUser(db, email, password) {
    await db.query("begin");
    const id = (
      await db.query(
        `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
           raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
           confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, reauthentication_token)
         values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
           extensions.crypt($2, extensions.gen_salt('bf')), now(),
           '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '')
         returning id`,
        [email, password],
      )
    ).rows[0].id;
    await db.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values ($1::text, $1::uuid, jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true), 'email', now(), now(), now())`,
      [id, email],
    );
    await db.query("commit");
    return id;
}

/** 入力を画面に出さずに1行読む(パスワード用) */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

// ログイン用の名前とパスワードを管理者が決める。
//   node scripts/db.mjs user <名前> [メール] [--empty]
// パスワードは環境変数 LOGIN_PASSWORD か、画面に出ない入力で受け取り、bcryptのハッシュだけをDBに保存する。
// メールのユーザーがいなければ作る。習慣リスト(SPEC 6.2)も入れるが、--empty なら空から始める。
// 作った人は app_metadata.allowed を付けるので、ALLOWED_EMAILS に足さなくてもログインできる
async function setUser(db, name, email, { empty = false } = {}) {
  name = (name || "").trim();
  if (!/^[^\s@]{2,30}$/.test(name)) {
    console.error("使い方: node scripts/db.mjs user <名前> [メール](名前は2〜30文字、空白と@は使えません)");
    process.exit(1);
  }
  email = (email || "").trim().toLowerCase();
  let user = email
    ? (await db.query("select id, email from auth.users where lower(email) = $1", [email])).rows[0]
    : (await db.query("select u.id, u.email from public.profiles p join auth.users u on u.id = p.user_id where lower(p.username) = lower($1)", [name])).rows[0];
  if (!user && !email) {
    console.error(`名前「${name}」の人はまだいません。新しく作るときはメールも指定してください。`);
    process.exit(1);
  }
  const taken = (await db.query("select 1 from public.profiles where lower(username) = lower($1) and user_id <> $2", [name, user?.id ?? "00000000-0000-0000-0000-000000000000"])).rows[0];
  if (taken) {
    console.error("その名前は別の人が使っています。");
    process.exit(1);
  }
  let pw = process.env.LOGIN_PASSWORD;
  if (!pw) {
    pw = await askHidden("パスワード(入力しても表示されません):");
    if ((await askHidden("もう一度パスワード:")) !== pw) {
      console.error("一致しませんでした。");
      process.exit(1);
    }
  }
  if (pw.length < 4) {
    console.error("パスワードは4文字以上にしてください。");
    process.exit(1);
  }
  if (!user) {
    const id = await createAuthUser(db, email, pw);
    user = { id, email };
    console.log(`${email} を作りました。`);
    if (empty) await db.query("insert into public.profiles (user_id) values ($1) on conflict (user_id) do nothing", [id]);
    else await seed(db, email);
  }
  await db.query("begin");
  await db.query("insert into public.profiles (user_id) values ($1) on conflict (user_id) do nothing", [user.id]);
  await db.query("update public.profiles set username = $2 where user_id = $1", [user.id, name]);
  await db.query(
    `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
       raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"allowed": true}'::jsonb
     where id = $1`,
    [user.id, pw],
  );
  await db.query("commit");
  console.log(`設定しました:名前「${name}」(${user.email})`);
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [cmd, arg, arg2] = args.filter((a) => !a.startsWith("--"));
const db = connect();
await db.connect();
try {
  if (cmd === "migrate") await migrate(db);
  else if (cmd === "seed") await seed(db, arg);
  else if (cmd === "test-user") await testUser(db);
  else if (cmd === "user") await setUser(db, arg, arg2, { empty: flags.has("--empty") });
  else console.error("使い方: node scripts/db.mjs migrate | seed [メール] | test-user | user <名前> [メール] [--empty]");
} finally {
  await db.end();
}
