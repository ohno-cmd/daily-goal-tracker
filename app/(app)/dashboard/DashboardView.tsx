"use client";

import { useState } from "react";
import { RateBars, RateLineChart, SleepChart } from "@/components/charts";
import { Card, Loading, SectionTitle, Stat, btnCls, yen } from "@/components/ui";
import { addDays, daysBetween, monthStartOf } from "@/lib/dates";
import { useRows } from "@/lib/rows";
import {
  average,
  averageRate,
  habitRates,
  longestStreak,
  minutesToTime,
  percent,
  pillarRates,
  sleepMinutes,
  timeToMinutes,
} from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import type { MonthlySales } from "@/lib/types";

const PERIODS = [
  { key: "30", label: "直近30日", days: 30 },
  { key: "90", label: "直近90日", days: 90 },
  { key: "all", label: "全期間", days: 0 },
] as const;

export function DashboardView() {
  const { status, error, habits, entries, checks } = useData();
  const { defs, days, start, today, streak } = useScores();
  const sales = useRows<MonthlySales & { sort_order?: number }>("monthly_sales", "month");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  if (status !== "ready") return <Loading error={error} />;

  const p = PERIODS.find((x) => x.key === period)!;
  const from = p.days ? [addDays(today, -(p.days - 1)), start].sort().at(-1)! : start;
  const inPeriod = days.filter((d) => d.date >= from);

  const pastEntries = [...entries.values()].filter((e) => e.date >= start && e.date <= today);
  const avgWake = average(pastEntries.map((e) => timeToMinutes(e.wake_time)));
  const avgSleep = average(pastEntries.map((e) => sleepMinutes(e.sleep_time)));

  const thisMonth = sales.rows.find((r) => r.month === monthStartOf(today));
  const target = thisMonth?.target_yen ?? 3_000_000;
  const actual = thisMonth?.actual_yen ?? null;

  const names = new Map(habits.map((h) => [h.id, h.name]));
  const activeDefs = defs.filter((d) => !d.archived_on);
  const hRates = habitRates(activeDefs, checks, from, today);
  const habitBars = hRates
    .filter((r) => r.rate != null)
    .map((r) => ({ label: names.get(r.habitId) ?? "", rate: r.rate! }))
    .sort((a, b) => a.rate - b.rate);
  const pillarBars = pillarRates(activeDefs, hRates)
    .map((x) => ({ label: x.pillar, rate: x.rate }))
    .sort((a, b) => a.rate - b.rate);

  const sleepData = inPeriod.map((d) => {
    const e = entries.get(d.date);
    return { date: d.date, wake: timeToMinutes(e?.wake_time), sleep: sleepMinutes(e?.sleep_time) };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">ダッシュボード</h1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="経過日数" value={`${daysBetween(start, today) + 1}日`} sub={`${start.replaceAll("-", "/")} から`} />
        <Stat label="全体の平均達成率" value={percent(averageRate(days, today))} />
        <Stat label="A全達成の日数" value={`${days.filter((d) => d.allA).length}日`} />
        <Stat label="現在の連続日数" value={`${streak}日`} />
        <Stat label="最長連続日数" value={`${longestStreak(days)}日`} />
        <Stat label="平均起床時刻" value={minutesToTime(avgWake)} />
        <Stat label="平均就寝時刻" value={minutesToTime(avgSleep)} sub="0時以降は24時台で計算" />
        <Stat label="今月の売上" value={actual == null ? "未入力" : percent(actual / target)} sub={`実績 ${yen(actual)} / 目標 ${yen(target)}`} />
      </div>

      <div className="flex gap-1">
        {PERIODS.map((x) => (
          <button
            key={x.key}
            onClick={() => setPeriod(x.key)}
            className={`${btnCls} ${period === x.key ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle right={<span className="text-xs text-zinc-500">期間平均 {percent(averageRate(inPeriod, today))}</span>}>日別達成率</SectionTitle>
          <RateLineChart data={inPeriod.filter((d) => d.max > 0)} />
        </Card>
        <Card>
          <SectionTitle>起床・就寝時刻</SectionTitle>
          {sleepData.some((d) => d.wake != null || d.sleep != null) ? <SleepChart data={sleepData} /> : <Empty />}
        </Card>
        <Card>
          <SectionTitle>習慣別の達成率(低い順)</SectionTitle>
          {habitBars.length ? <RateBars data={habitBars} /> : <Empty />}
        </Card>
        <Card>
          <SectionTitle>柱別の平均達成率</SectionTitle>
          {pillarBars.length ? <RateBars data={pillarBars} /> : <Empty />}
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-zinc-400">まだ記録がありません</p>;
}
