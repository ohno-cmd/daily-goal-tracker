"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Loading, primaryBtnCls, rateColor } from "@/components/ui";
import { addDays, formatMd, hourInTokyo, weekday, weekStartOf, WEEKDAYS, type DateStr } from "@/lib/dates";
import { useRows } from "@/lib/rows";
import { evaluateRewards, isActiveOn, longestStreak, percent, summarizeWeek, weekStarts } from "@/lib/scoring";
import { useData, usePillarTerm, useScores } from "@/lib/store";
import { TIME_SLOTS, type Reward, type TextItem } from "@/lib/types";
import mascot from "@/public/loading.png";

/** ホーム(TOP)。目標・今週の達成率・今日の様子をひと目で */
export function HomeView() {
  const { status, error, profile, habits, checks } = useData();
  const { defs, today, day, streak, days, start } = useScores();
  const rewards = useRows<Reward & { sort_order?: number }>("rewards", "step");
  const affirmations = useRows<TextItem>("affirmations");
  const [bounce, setBounce] = useState(0);
  const { title: pillarTitle } = usePillarTerm();

  const rule = { rate: Number(profile?.reward_rate ?? 0.8), aDays: profile?.reward_a_days ?? 6 };
  const week = useMemo(() => {
    const all = weekStarts(start, today).map((w) => summarizeWeek(defs, checks, w, today));
    const statuses = evaluateRewards(all, rule, rewards.rows.length, today);
    const i = all.findIndex((w) => w.weekStart === weekStartOf(today));
    return i >= 0 ? { summary: all[i], status: statuses[i] } : null;
  }, [defs, checks, start, today, rule.rate, rule.aDays, rewards.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== "ready") return <Loading error={error} />;

  const name = profile?.username || profile?.display_name || "";
  const hour = hourInTokyo();
  const greeting = hour >= 4 && hour < 10 ? "おはよう" : hour >= 10 && hour < 17 ? "こんにちは" : "こんばんは";
  const r = day(today);
  const yesterday = addDays(today, -1);
  const monthADays = days.filter((d) => d.date.slice(0, 7) === today.slice(0, 7) && d.allA).length;
  // 途切れた次の日:昨日は◎でなく、それより前に◎の日がある
  const comeback = !day(yesterday).allA && days.some((d) => d.date < yesterday && d.allA);

  // 次にやる習慣:今の時間帯から先の、まだ✓していないもの
  const slotNow = hour < 11 ? 0 : hour < 18 ? 1 : 2;
  const order = [...TIME_SLOTS.slice(slotNow), ...TIME_SLOTS.slice(0, slotNow)].map((s) => s.value);
  const defById = new Map(defs.map((d) => [d.id, d]));
  const done = checks.get(today) ?? new Set<string>();
  const next = habits
    .filter((h) => defById.get(h.id) && isActiveOn(defById.get(h.id)!, today) && !done.has(h.id))
    .sort((a, b) => order.indexOf(a.time_slot) - order.indexOf(b.time_slot))
    .slice(0, 3);

  // 今日のことば:アファメーションから日替わりで1つ
  const lines = affirmations.rows.filter((a) => a.text.trim());
  const seed = [...today].reduce((s, c) => s * 31 + c.charCodeAt(0), 7);
  const quote = lines.length ? lines[Math.abs(seed) % lines.length].text : "";

  const rewardText = (step: number | null) => rewards.rows.find((x) => x.step === step)?.text || "";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* あいさつ */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-pink-300 via-pink-200 to-purple-300 p-5 text-purple-950 shadow-[0_10px_30px_-12px_rgba(219,39,119,0.5)] dark:from-pink-900 dark:via-purple-900 dark:to-purple-950 dark:text-purple-50">
        <span className="absolute -left-4 -top-6 text-7xl opacity-20" aria-hidden>
          ✿
        </span>
        <span className="absolute bottom-2 left-1/2 text-xl opacity-40" aria-hidden>
          ✦
        </span>
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold opacity-70">
              {formatMd(today)}
              {streak > 0 && <span className="ml-2">🔥 {streak}日連続</span>}
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-tight">
              {greeting}
              {name && (
                <>
                  、<span className="whitespace-nowrap">{name}</span>
                </>
              )}
              <span aria-hidden> 🌸</span>
            </h1>
            <p className="mt-1 text-sm opacity-80">{cheer(r.rate, r.allA, hour, comeback)}</p>
          </div>
          <button type="button" onClick={() => setBounce((b) => b + 1)} aria-label="マスコット" className="shrink-0">
            <Image key={bounce} src={mascot} alt="" width={112} unoptimized priority className="animate-[wiggle_1.2s_ease-in-out_2] rounded-2xl" />
          </button>
        </div>
      </section>

      {/* 目標 */}
      <Link href="/goals" className="block rounded-3xl border border-pink-100 bg-white/85 p-4 shadow-[0_6px_24px_-12px_rgba(219,39,119,0.35)] backdrop-blur transition active:scale-[0.99] dark:border-purple-950 dark:bg-zinc-900/70">
        <div className="text-xs font-bold text-pink-500">🎯 最終目標</div>
        <p className="mt-1 text-lg font-bold leading-snug">{profile?.final_goal || <span className="text-zinc-400">まだ決めていません ✏️</span>}</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-purple-50/80 px-3 py-2 text-sm dark:bg-purple-950/40">
          <span className="text-xs font-bold text-purple-500">中間目標</span>
          <span className="min-w-0 flex-1 truncate">{profile?.mid_goal || <span className="text-zinc-400">未設定</span>}</span>
          <span className="text-pink-400">›</span>
        </div>
      </Link>

      {/* 今週の達成率 */}
      {week && (
        <Link href="/review" className="block rounded-3xl border border-pink-100 bg-white/85 p-5 shadow-[0_6px_24px_-12px_rgba(219,39,119,0.35)] backdrop-blur transition active:scale-[0.99] dark:border-purple-950 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-purple-900/70 dark:text-purple-200/70">💜 今週の達成率</h2>
            <span className="text-xs text-zinc-400">
              {formatMd(week.summary.weekStart, false)}〜{formatMd(addDays(week.summary.weekStart, 6), false)}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-5">
            <BigRing rate={week.summary.rate ?? 0} />
            <div className="flex-1 space-y-2 text-sm">
              <Row label="点数" value={`${week.summary.score}`} sub={`/ ${week.status.threshold}`} />
              <Row label="◎の日" value={`${week.summary.aDays}`} sub={`/ ${rule.aDays}日`} />
              <RewardChip status={week.status} text={rewardText} />
            </div>
          </div>
          <WeekBars days={week.summary.days.map((d) => ({ date: d.date, rate: d.rate, allA: d.allA, has: d.max > 0 }))} today={today} />
        </Link>
      )}

      {/* 今日 */}
      <section className="rounded-3xl border border-pink-100 bg-white/85 p-4 shadow-[0_6px_24px_-12px_rgba(219,39,119,0.35)] backdrop-blur dark:border-purple-950 dark:bg-zinc-900/70">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-purple-900/70 dark:text-purple-200/70">☀️ 今日</h2>
          <span className="text-sm font-bold tabular-nums">
            {r.score}
            <span className="font-normal text-zinc-400"> / {r.max}点</span>
            <span className="ml-2 bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">{r.allA ? "◎" : percent(r.rate)}</span>
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-pink-100 dark:bg-purple-950">
          <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500 transition-all" style={{ width: `${Math.round(r.rate * 100)}%` }} />
        </div>
        {next.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {next.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-pink-200 dark:border-purple-800" aria-hidden />
                <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-400">{h.time_label === "—" ? "" : h.time_label}</span>
                <span className="truncate">{h.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          habits.length > 0 && <p className="mt-3 text-sm font-bold text-purple-600">今日の習慣はぜんぶ✓ 🎉</p>
        )}
        <Link href="/today" className={`${primaryBtnCls} mt-4 w-full`}>
          {habits.length ? "✓をつける" : "習慣を決める"}
        </Link>
      </section>

      {/* 連続日数と今日のことば */}
      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-2 grid grid-rows-2 gap-2">
          <div className="flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-pink-100 to-purple-100 p-2 dark:from-pink-950/40 dark:to-purple-950/40">
            <span className="text-2xl" aria-hidden>
              🌷
            </span>
            <div className="leading-tight">
              <div className="text-[11px] text-zinc-500">今月の◎</div>
              <div className="text-xl font-bold tabular-nums" data-testid="month-a-days">
                {monthADays}日
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-orange-100 to-pink-100 p-2 dark:from-orange-950/40 dark:to-pink-950/40">
            <span className="text-2xl" aria-hidden>
              🔥
            </span>
            <div className="leading-tight">
              <div className="text-[11px] text-zinc-500">連続(最長{longestStreak(days)})</div>
              <div className="text-xl font-bold tabular-nums">{streak}日</div>
            </div>
          </div>
        </div>
        <Link href="/affirmation" className="col-span-3 flex flex-col justify-center rounded-3xl bg-gradient-to-br from-purple-100 to-pink-50 p-4 dark:from-purple-950/50 dark:to-pink-950/30">
          <span className="text-xs font-bold text-purple-500">💬 今日のことば</span>
          <span className="mt-1 line-clamp-4 text-sm font-medium leading-relaxed">{quote || <span className="text-zinc-400">アファメーションを書いてみよう</span>}</span>
        </Link>
      </div>

      {/* ショートカット */}
      <nav className="grid grid-cols-3 gap-2">
        {[
          ["/wins", "🌟", "できたこと"],
          ["/affirmation", "💖", "ことば"],
          ["/pillars", "🏛️", pillarTitle],
          ["/history", "📅", "カレンダー"],
          ["/review", "📝", "週次レビュー"],
          ["/dashboard", "📊", "グラフ"],
        ].map(([href, emoji, label]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-3xl border border-pink-100 bg-white/80 text-xs font-bold text-purple-900/70 transition active:scale-95 dark:border-purple-950 dark:bg-zinc-900/60 dark:text-purple-200/70"
          >
            <span className="text-2xl" aria-hidden>
              {emoji}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** ひとこと */
function cheer(rate: number, allA: boolean, hour: number, comeback: boolean): string {
  if (allA && comeback) return "また始められた!そんな自分がえらい 🌷";
  if (allA) return "今日はA全達成!最高の一日 ✨";
  if (comeback) return "おかえり!また始めた自分えらい 🌷";
  if (rate >= 0.6) return "いい調子。このままいこう 💪";
  if (rate > 0) return "ひとつずつ、できたら✓を付けよう";
  return hour < 12 ? "今日もいい一日にしよう ☀️" : "今からでも大丈夫。ひとつ✓してみよう";
}

function Row({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="font-bold tabular-nums">
        {value}
        <span className="text-xs font-normal text-zinc-400"> {sub}</span>
      </span>
    </div>
  );
}

function RewardChip({ status, text }: { status: ReturnType<typeof evaluateRewards>[number]; text: (s: number | null) => string }) {
  if (status.kind === "cleared")
    return <div className="rounded-full bg-gradient-to-r from-pink-400 to-purple-500 px-3 py-1 text-center text-xs font-bold text-white">🎁 {text(status.step) || "ご褒美ゲット"}</div>;
  if (status.kind === "in_progress")
    return (
      <div className="rounded-full bg-pink-50 px-3 py-1 text-center text-xs text-pink-600 dark:bg-pink-950/40 dark:text-pink-300">
        🎁 あと{status.pointsLeft}点・◎{status.aDaysLeft}日
      </div>
    );
  return null;
}

function BigRing({ rate }: { rate: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="week-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="11" className="stroke-pink-100 dark:stroke-purple-950" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#week-ring)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, rate))}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" data-testid="week-rate">
          {Math.round(rate * 100)}
          <span className="text-base">%</span>
        </span>
        <span className="text-[10px] text-zinc-400">今週の平均</span>
      </div>
    </div>
  );
}

function WeekBars({ days, today }: { days: { date: DateStr; rate: number; allA: boolean; has: boolean }[]; today: DateStr }) {
  return (
    <div className="mt-4 grid grid-cols-7 gap-2">
      {days.map((d) => {
        const future = d.date > today;
        return (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end overflow-hidden rounded-xl bg-pink-50 dark:bg-purple-950/40">
              {!future && d.has && (
                <div
                  className="flex w-full items-start justify-center rounded-xl pt-0.5 text-[11px] font-bold text-white transition-all"
                  style={{ height: `${Math.max(6, Math.round(d.rate * 100))}%`, backgroundColor: rateColor(d.rate) }}
                >
                  {d.allA && d.rate >= 0.25 ? "◎" : ""}
                </div>
              )}
            </div>
            <span className={`text-[11px] ${d.date === today ? "rounded-full bg-purple-500 px-1.5 font-bold text-white" : "text-zinc-400"}`}>
              {WEEKDAYS[weekday(d.date)]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
