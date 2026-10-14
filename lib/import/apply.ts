// ImportPlan をDBに保存する(ログイン中のユーザーの権限で行うので、自分の行にしか書けない)
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Habit, Pillar, Profile } from "../types";
import { normName, pillarMatches, type ImportPlan } from "./sheets";

const CHUNK = 500;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}:${error.message}`);
  return data;
}

async function inChunks<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await fn(rows.slice(i, i + CHUNK));
}

export async function applyPlan(sb: SupabaseClient, plan: ImportPlan, onStep: (s: string) => void): Promise<void> {
  let habits = await must(sb.from("habits").select("*").order("sort_order"), "習慣の読み込み") as Habit[];
  const byName = () => new Map(habits.map((h) => [normName(h.name), h]));

  // 習慣リスト:名前で照合して更新、無ければ追加。並び順はシートの順
  if (plan.habits?.length) {
    onStep("習慣を保存中…");
    const map = byName();
    for (const [i, h] of plan.habits.entries()) {
      const fields = { ...h, sort_order: (i + 1) * 10 };
      const found = map.get(normName(h.name));
      if (found) await must(sb.from("habits").update(fields).eq("id", found.id), `習慣「${h.name}」`);
      else await must(sb.from("habits").insert(fields), `習慣「${h.name}」`);
    }
    habits = await must(sb.from("habits").select("*").order("sort_order"), "習慣の読み込み") as Habit[];
  }

  const profile = (await must(sb.from("profiles").select("*").limit(1), "プロフィール") as Profile[])[0];

  // 日次チェック:同じ日付は上書き
  if (plan.daily?.dates.length) {
    onStep("日次記録を保存中…");
    const d = plan.daily;
    const map = byName();
    await inChunks(d.dates, (dates) => must(sb.from("habit_checks").delete().in("date", dates), "✓の削除"));
    const checks = [...d.checks].flatMap(([date, names]) =>
      names.map((n) => map.get(normName(n))).filter((h): h is Habit => !!h).map((h) => ({ date, habit_id: h.id })),
    );
    await inChunks(checks, (rows) => must(sb.from("habit_checks").insert(rows), "✓の保存"));
    const entries = d.dates.map((date) => ({ date, ...d.entries.get(date) }));
    await inChunks(entries, (rows) => must(sb.from("daily_entries").upsert(rows, { onConflict: "user_id,date" }), "日次記録の保存"));

    // 取り込んだ最初の日から満点に数える(今日作った習慣でも過去の点数が出るように)
    const first = d.dates.reduce((a, b) => (a < b ? a : b));
    const rowNames = new Set(d.habitRows.map(normName));
    const targets = habits.filter((h) => !h.archived_at && h.active_from > first && (rowNames.has(normName(h.name)) || !rowNames.size));
    for (const h of targets) {
      await must(sb.from("habits").update({ active_from: first }).eq("id", h.id), "習慣の開始日");
      // 最初の優先度の履歴も同じ日にそろえる
      const vs = await must(sb.from("habit_versions").select("id, valid_from").eq("habit_id", h.id).order("valid_from").limit(1), "優先度の履歴") as { id: string; valid_from: string }[];
      if (vs[0] && vs[0].valid_from > first) await must(sb.from("habit_versions").update({ valid_from: first }).eq("id", vs[0].id), "優先度の履歴");
    }
    if (profile && first < profile.started_on) await must(sb.from("profiles").update({ started_on: first }).eq("id", profile.id), "開始日");
  }

  // 目標の全体像
  if (plan.goals) {
    onStep("目標を保存中…");
    const g = plan.goals;
    const patch: Partial<Profile> = {};
    if (g.final_goal) patch.final_goal = g.final_goal;
    if (g.mid_goal) patch.mid_goal = g.mid_goal;
    if (g.three_month_note) patch.three_month_note = g.three_month_note;
    if (profile && Object.keys(patch).length) await must(sb.from("profiles").update(patch).eq("id", profile.id), "目標");
    if (g.benefactors.length) {
      await must(sb.from("benefactors").delete().not("id", "is", null), "恩返しリストの削除");
      await must(sb.from("benefactors").insert(g.benefactors.map((b, i) => ({ ...b, sort_order: (i + 1) * 10 }))), "恩返しリスト");
    }
    if (g.sales.length) {
      const rows = g.sales.map(({ target_yen, ...s }) => ({ ...s, ...(target_yen != null ? { target_yen } : {}) }));
      await must(sb.from("monthly_sales").upsert(rows, { onConflict: "user_id,month" }), "月次売上");
    }
  }

  // 5つの柱:名前で照合して更新、無ければ追加。同じ名前の習慣を柱に紐づける
  if (plan.pillars?.length) {
    onStep("5つの柱を保存中…");
    const existing = await must(sb.from("pillars").select("*"), "柱の読み込み") as Pillar[];
    const map = new Map(existing.map((p) => [normName(p.name), p]));
    for (const [i, p] of plan.pillars.entries()) {
      const found = map.get(normName(p.name));
      const fields = { ...p, sort_order: (i + 1) * 10 };
      const saved = found
        ? (await must(sb.from("pillars").update(fields).eq("id", found.id).select().single(), `柱「${p.name}」`) as Pillar)
        : (await must(sb.from("pillars").insert(fields).select().single(), `柱「${p.name}」`) as Pillar);
      const linked = habits.filter((h) => pillarMatches(p.name, h.pillar_label));
      for (const h of linked) await must(sb.from("habits").update({ pillar_id: saved.id }).eq("id", h.id), "柱の紐づけ");
    }
  }

  // 週次レビュー:同じ週は上書き
  if (plan.reviews?.length) {
    onStep("週次レビューを保存中…");
    const map = byName();
    const rows = plan.reviews.map(({ worst_habit_name, ...r }) => ({ ...r, worst_habit_id: map.get(normName(worst_habit_name))?.id ?? null }));
    await must(sb.from("weekly_reviews").upsert(rows, { onConflict: "user_id,week_start" }), "週次レビュー");
  }

  // アファメーション・ご褒美・気分転換リストは置き換える
  if (plan.affirmations?.length) {
    onStep("アファメーションを保存中…");
    await must(sb.from("affirmations").delete().not("id", "is", null), "アファメーションの削除");
    await must(sb.from("affirmations").insert(plan.affirmations.map((text, i) => ({ text, sort_order: (i + 1) * 10 }))), "アファメーション");
  }
  if (plan.rewards) {
    onStep("ご褒美を保存中…");
    const r = plan.rewards;
    if (r.steps.length) {
      await must(sb.from("rewards").delete().not("id", "is", null), "ご褒美の削除");
      await must(sb.from("rewards").insert(r.steps.map((text, i) => ({ step: i + 1, text }))), "ご褒美");
    }
    if (profile && (r.rate != null || r.aDays != null)) {
      await must(
        sb.from("profiles").update({ ...(r.rate != null ? { reward_rate: r.rate } : {}), ...(r.aDays != null ? { reward_a_days: r.aDays } : {}) }).eq("id", profile.id),
        "ご褒美ルール",
      );
    }
    if (r.moodBoosters.length) {
      await must(sb.from("mood_boosters").delete().not("id", "is", null), "気分転換リストの削除");
      await must(sb.from("mood_boosters").insert(r.moodBoosters.map((text, i) => ({ text, sort_order: (i + 1) * 10 }))), "気分転換リスト");
    }
  }
  onStep("完了");
}
