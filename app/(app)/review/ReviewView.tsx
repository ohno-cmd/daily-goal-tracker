"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReviewTabs } from "@/components/ReviewTabs";
import { AutoText, Card, Loading, btnCls, inputCls, rateColor } from "@/components/ui";
import { addDays, formatMd, hourInTokyo, weekday, type DateStr } from "@/lib/dates";
import { useRows } from "@/lib/rows";
import {
  evaluateRewards,
  habitRates,
  percent,
  summarizeWeek,
  weekStarts,
  type RewardStatus,
  type WeekSummary,
} from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import type { Reward, WeeklyReview } from "@/lib/types";

export function ReviewView() {
  const { status, error, checks, profile } = useData();
  const { defs, start, today } = useScores();
  const reviews = useRows<WeeklyReview & { sort_order?: number }>("weekly_reviews", "week_start");
  const rewards = useRows<Reward & { sort_order?: number }>("rewards", "step");

  const rule = { rate: Number(profile?.reward_rate ?? 0.8), aDays: profile?.reward_a_days ?? 6 };
  const weeks = useMemo(() => weekStarts(start, today).map((w) => summarizeWeek(defs, checks, w, today)), [defs, checks, start, today]);
  const statuses = useMemo(() => evaluateRewards(weeks, rule, rewards.rows.length, today), [weeks, rule.rate, rule.aDays, rewards.rows.length, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== "ready" || reviews.status === "loading") return <Loading error={error} />;

  // 日曜の夜(18時以降)はその週のカードを開いておく
  const sundayNight = weekday(today) === 0 && hourInTokyo() >= 18;
  const rewardText = (step: number | null) => rewards.rows.find((r) => r.step === step)?.text || (step ? `${step}週目のご褒美` : "");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ReviewTabs />
      <p className="text-xs text-zinc-500">
        ご褒美の条件:週の点数が 1日の満点×7×{percent(rule.rate)} 以上、かつ A全達成 {rule.aDays}日以上(
        <Link href="/settings#rewards" className="underline">
          変更
        </Link>
        )
      </p>
      {[...weeks.keys()].reverse().map((i) => (
        <WeekCard
          key={weeks[i].weekStart}
          week={weeks[i]}
          status={statuses[i]}
          rewardText={rewardText}
          review={reviews.rows.find((r) => r.week_start === weeks[i].weekStart)}
          save={(patch) => reviews.upsert({ week_start: weeks[i].weekStart, ...patch }, "user_id,week_start")}
          defaultOpen={sundayNight && i === weeks.length - 1}
          today={today}
          habitRateFor={(w) => habitRates(defs.filter((d) => !d.archived_on), checks, w.weekStart, [addDays(w.weekStart, 6), today].sort()[0])}
        />
      ))}
    </div>
  );
}

function RewardBadge({ status, rewardText }: { status: RewardStatus; rewardText: (s: number | null) => string }) {
  if (status.kind === "cleared")
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        🎁 {rewardText(status.step)}
      </span>
    );
  if (status.kind === "in_progress")
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        あと{status.pointsLeft}点・◎あと{status.aDaysLeft}日
      </span>
    );
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-400 dark:bg-zinc-800">ご褒美なし</span>;
}

function WeekCard({
  week,
  status,
  rewardText,
  review,
  save,
  defaultOpen,
  today,
  habitRateFor,
}: {
  week: WeekSummary;
  status: RewardStatus;
  rewardText: (s: number | null) => string;
  review: WeeklyReview | undefined;
  save: (patch: Partial<WeeklyReview>) => Promise<WeeklyReview | null>;
  defaultOpen: boolean;
  today: DateStr;
  habitRateFor: (w: WeekSummary) => ReturnType<typeof habitRates>;
}) {
  const { habits, saveHabit } = useData();
  const [open, setOpen] = useState(defaultOpen);
  const [applied, setApplied] = useState(false);
  const end = addDays(week.weekStart, 6);
  const current = week.weekStart <= today && today <= end;

  // 一番崩れた習慣の初期値:その週の達成率が最も低い習慣
  const rates = open ? habitRateFor(week) : [];
  const lowest = rates.filter((r) => r.rate != null).sort((a, b) => a.rate! - b.rate!)[0]?.habitId ?? null;
  const worstId = review?.worst_habit_id ?? lowest;
  const worst = habits.find((h) => h.id === worstId);

  // 最初の保存で、初期値の「一番崩れた習慣」も一緒に残す
  const saveField = (patch: Partial<WeeklyReview>) => save(review ? patch : { worst_habit_id: worstId, ...patch }).then((r) => !!r);

  return (
    <Card className="!p-0" id={`w-${week.weekStart}`}>
      <button className="flex w-full flex-col gap-2 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex w-full items-center justify-between gap-2">
          <span className="font-bold">
            {formatMd(week.weekStart)} 〜 {formatMd(end)}
            {current && <span className="ml-2 text-xs font-normal text-emerald-600">今週</span>}
          </span>
          <RewardBadge status={status} rewardText={rewardText} />
        </div>
        <div className="flex w-full items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            平均 <b className="text-zinc-900 dark:text-zinc-100">{percent(week.rate)}</b>
          </span>
          <span>
            点数 <b className="text-zinc-900 dark:text-zinc-100">{week.score}</b>
            <span className="text-xs">/{status.threshold}</span>
          </span>
          <span>
            ◎ <b className="text-zinc-900 dark:text-zinc-100">{week.aDays}</b>日
          </span>
          <span className="ml-auto flex gap-0.5" aria-hidden>
            {week.days.map((d) => (
              <span
                key={d.date}
                className="h-4 w-3 rounded-sm"
                style={{ backgroundColor: d.date <= today && d.max > 0 ? rateColor(d.rate) : "var(--color-zinc-200, #e4e4e7)", opacity: d.date <= today ? 1 : 0.4 }}
              />
            ))}
          </span>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-zinc-100 p-4 dark:border-zinc-800">
          {status.kind === "cleared" && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              クリア({status.clearIndex}回目)!今週のご褒美:<b>{rewardText(status.step)}</b>
            </p>
          )}
          {status.kind === "in_progress" && (
            <p className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
              ご褒美まで あと<b>{status.pointsLeft}点</b>・◎あと<b>{status.aDaysLeft}日</b>
              {!status.possible && "(今週の◎は届かない見込み)"}
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">一番崩れた習慣</span>
            <select value={worstId ?? ""} onChange={(e) => save({ worst_habit_id: e.target.value || null })} className={inputCls}>
              <option value="">選ばない</option>
              {habits
                .filter((h) => !h.archived_at || h.id === worstId)
                .map((h) => {
                  const r = rates.find((x) => x.habitId === h.id)?.rate;
                  return (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {r != null ? `(${percent(r)})` : ""}
                    </option>
                  );
                })}
            </select>
          </label>
          <AutoText label="原因" multiline rows={2} value={review?.cause ?? ""} onSave={(v) => saveField({ cause: v })} />
          <AutoText label="If-Thenの修正" multiline rows={2} value={review?.if_then_fix ?? ""} onSave={(v) => saveField({ if_then_fix: v })} />
          {worst && (
            <div className="text-xs text-zinc-500">
              今のIf-Then:{worst.if_then || "未設定"}
              <button
                className={`${btnCls} ml-2 mt-1`}
                disabled={!review?.if_then_fix.trim()}
                onClick={async () => {
                  if (await saveHabit(worst.id, { if_then: review!.if_then_fix.trim() })) setApplied(true);
                }}
              >
                If-Thenを習慣に反映
              </button>
              {applied && <span className="ml-2 text-emerald-600">反映しました</span>}
            </div>
          )}
          <AutoText label="来週の大きな石" multiline rows={2} value={review?.next_big_rock ?? ""} onSave={(v) => saveField({ next_big_rock: v })} />
        </div>
      )}
    </Card>
  );
}
