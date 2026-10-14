// データベースの管理用。.env.local の DATABASE_URL(Supabase の Session pooler 接続文字列)を使う。
//   npm run db:migrate          supabase/migrations の未適用のSQLを順に流す
//   npm run db:seed -- <メール>  そのユーザーに習慣リスト(SPEC 6.2)を入れる。省略時は ALLOWED_EMAILS の1件目
//   npm run set-login            ログイン用の名前とパスワードを決める(入力は画面に出ない)
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
    console.log(`${email} を作りました。`);
  }
  await seed(db, email);
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

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ログイン用の名前とパスワードを決める(メールが送れないときの最初の設定用)。
// パスワードはこの端末で入力し、bcryptのハッシュだけをDBに保存する
async function setLogin(db, email) {
  email = (email || (process.env.ALLOWED_EMAILS || "").split(",")[0] || "").trim().toLowerCase();
  const user = (await db.query("select id from auth.users where lower(email) = $1", [email])).rows[0];
  if (!user) {
    console.error(`${email} のユーザーが見つかりません。`);
    process.exit(1);
  }
  console.log(`${email} のログイン用の名前とパスワードを決めます。`);
  const name = await ask("名前(2〜30文字、空白と@は使えません):");
  if (!/^[^\s@]{2,30}$/.test(name)) {
    console.error("名前の形が正しくありません。");
    process.exit(1);
  }
  const taken = (await db.query("select 1 from public.profiles where lower(username) = lower($1) and user_id <> $2", [name, user.id])).rows[0];
  if (taken) {
    console.error("その名前は使われています。");
    process.exit(1);
  }
  const pw = await askHidden("パスワード(8文字以上。入力しても表示されません):");
  if (pw.length < 8) {
    console.error("8文字以上にしてください。");
    process.exit(1);
  }
  if ((await askHidden("もう一度パスワード:")) !== pw) {
    console.error("一致しませんでした。もう一度最初からやり直してください。");
    process.exit(1);
  }
  await db.query("begin");
  await db.query("insert into public.profiles (user_id) values ($1) on conflict (user_id) do nothing", [user.id]);
  await db.query("update public.profiles set username = $2 where user_id = $1", [user.id, name]);
  await db.query("update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) where id = $1", [user.id, pw]);
  await db.query("commit");
  console.log(`設定しました。名前「${name}」とパスワードでログインできます。`);
}

const [cmd, arg] = process.argv.slice(2);
const db = connect();
await db.connect();
try {
  if (cmd === "migrate") await migrate(db);
  else if (cmd === "seed") await seed(db, arg);
  else if (cmd === "test-user") await testUser(db);
  else if (cmd === "set-login") await setLogin(db, arg);
  else console.error("使い方: node scripts/db.mjs migrate | seed [メール] | test-user | set-login [メール]");
} finally {
  await db.end();
}
