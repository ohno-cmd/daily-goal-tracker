// 集計ロジック(SPEC 5章)。すべて純粋関数。DBには入力された事実だけを置き、表示のたびにここで計算する
import { addDays, eachDay, weekStartOf, type DateStr } from "./dates";

export type Priority = "A" | "B" | "C";
export const POINTS: Record<Priority, number> = { A: 3, B: 2, C: 1 };

export interface PriorityVersion {
  valid_from: DateStr;
  priority: Priority;
}

/** 計算に必要な習慣の情報 */
export interface HabitDef {
  id: string;
  priority: Priority;
  pillar_label: string;
  /** この日から満点に数える */
  active_from: DateStr;
  /** アーカイブした日(日本時間)。この日から数えない */
  archived_on: DateStr | null;
  /** 優先度の履歴(valid_from の昇順) */
  versions: PriorityVersion[];
}

/** 日付 → その日に✓した習慣のid */
export type ChecksByDate = Map<DateStr, Set<string>>;

export function isActiveOn(h: HabitDef, d: DateStr): boolean {
  return h.active_from <= d && (!h.archived_on || d < h.archived_on);
}

/** その日に有効だった優先度。履歴より前の日は最初の優先度を使う */
export function priorityOn(h: HabitDef, d: DateStr): Priority {
  let p: Priority | undefined;
  for (const v of h.versions) {
    if (v.valid_from <= d) p = v.priority;
    else break;
  }
  return p ?? h.versions[0]?.priority ?? h.priority;
}

export interface DayResult {
  date: DateStr;
  score: number;
  max: number;
  /** 0〜1。満点が0の日は0 */
  rate: number;
  /** その日に有効な優先度Aがすべて✓(Aが1つも無い日は false) */
  allA: boolean;
  aTotal: number;
  aChecked: number;
}

export function scoreDay(habits: HabitDef[], checked: Set<string> | undefined, date: DateStr): DayResult {
  let score = 0, max = 0, aTotal = 0, aChecked = 0;
  for (const h of habits) {
    if (!isActiveOn(h, date)) continue;
    const p = priorityOn(h, date);
    const on = checked?.has(h.id) ?? false;
    max += POINTS[p];
    if (on) score += POINTS[p];
    if (p === "A") {
      aTotal++;
      if (on) aChecked++;
    }
  }
  return { date, score, max, rate: max ? score / max : 0, allA: aTotal > 0 && aChecked === aTotal, aTotal, aChecked };
}

/** from〜to の各日の結果 */
export function scoreDays(habits: HabitDef[], checks: ChecksByDate, from: DateStr, to: DateStr): DayResult[] {
  if (from > to) return [];
  return eachDay(from, to).map((d) => scoreDay(habits, checks.get(d), d));
}

/**
 * 連続日数:今日からさかのぼって◎が途切れず続いている日数。
 * 今日がまだ◎でないときは昨日までで数える(朝に0に戻らないように)
 */
export function currentStreak(isAllA: (d: DateStr) => boolean, today: DateStr, start?: DateStr): number {
  let d = isAllA(today) ? today : addDays(today, -1);
  let n = 0;
  while ((!start || d >= start) && isAllA(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** 全期間で◎が続いた最長の日数(days は日付の昇順・連続) */
export function longestStreak(days: DayResult[]): number {
  let best = 0, run = 0;
  for (const r of days) {
    run = r.allA ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** 平均達成率。未来の日は含めない。入力の無い過去の日は0%として含める。満点0の日(習慣が無い日)は除く */
export function averageRate(days: DayResult[], today: DateStr): number | null {
  const xs = days.filter((r) => r.date <= today && r.max > 0);
  if (!xs.length) return null;
  return xs.reduce((s, r) => s + r.rate, 0) / xs.length;
}

export interface HabitRate {
  habitId: string;
  activeDays: number;
  checkedDays: number;
  rate: number | null;
}

/** 習慣別達成率:その習慣が有効だった日数のうち✓した日数の割合 */
export function habitRates(habits: HabitDef[], checks: ChecksByDate, from: DateStr, to: DateStr): HabitRate[] {
  const days = from <= to ? eachDay(from, to) : [];
  return habits.map((h) => {
    let activeDays = 0, checkedDays = 0;
    for (const d of days) {
      if (!isActiveOn(h, d)) continue;
      activeDays++;
      if (checks.get(d)?.has(h.id)) checkedDays++;
    }
    return { habitId: h.id, activeDays, checkedDays, rate: activeDays ? checkedDays / activeDays : null };
  });
}

/** 柱別達成率:その柱に紐づく習慣の習慣別達成率の平均 */
export function pillarRates(habits: HabitDef[], rates: HabitRate[]): { pillar: string; rate: number; habits: number }[] {
  const byId = new Map(rates.map((r) => [r.habitId, r]));
  const groups = new Map<string, number[]>();
  for (const h of habits) {
    const r = byId.get(h.id)?.rate;
    if (r == null || !h.pillar_label) continue;
    groups.set(h.pillar_label, [...(groups.get(h.pillar_label) ?? []), r]);
  }
  return [...groups].map(([pillar, xs]) => ({ pillar, rate: xs.reduce((s, x) => s + x, 0) / xs.length, habits: xs.length }));
}

// ───────── 週の集計とご褒美 ─────────

export interface WeekSummary {
  weekStart: DateStr;
  days: DayResult[];
  /** 点数合計 */
  score: number;
  /** 平均達成率(今日までの日で計算) */
  rate: number | null;
  /** A全達成日数 */
  aDays: number;
  /** 1日の満点(週の中で一番大きい満点) */
  dailyMax: number;
  /** その週が日曜まで終わったか */
  finished: boolean;
}

export function summarizeWeek(habits: HabitDef[], checks: ChecksByDate, weekStart: DateStr, today: DateStr): WeekSummary {
  const days = scoreDays(habits, checks, weekStart, addDays(weekStart, 6));
  const past = days.filter((r) => r.date <= today);
  return {
    weekStart,
    days,
    score: past.reduce((s, r) => s + r.score, 0),
    rate: averageRate(days, today),
    aDays: past.filter((r) => r.allA).length,
    dailyMax: Math.max(0, ...days.map((r) => r.max)),
    finished: addDays(weekStart, 6) < today,
  };
}

export interface RewardRule {
  /** 週の目標達成率(0〜1) */
  rate: number;
  /** 必要なA全達成日数 */
  aDays: number;
}

export type RewardStatus =
  | { kind: "cleared"; clearIndex: number; step: number | null; threshold: number }
  | { kind: "in_progress"; threshold: number; pointsLeft: number; aDaysLeft: number; possible: boolean }
  | { kind: "missed"; threshold: number };

export function weekThreshold(dailyMax: number, rule: RewardRule): number {
  return Math.round(dailyMax * 7 * rule.rate);
}

export function isWeekCleared(w: WeekSummary, rule: RewardRule): boolean {
  return w.dailyMax > 0 && w.score >= weekThreshold(w.dailyMax, rule) && w.aDays >= rule.aDays;
}

/** N回目のクリアに出すご褒美の段(最後まで行ったら1に戻る) */
export function rewardStep(n: number, rewardCount: number): number | null {
  if (rewardCount <= 0 || n <= 0) return null;
  return ((n - 1) % rewardCount) + 1;
}

/** 週ごとのご褒美の判定(weeks は古い順) */
export function evaluateRewards(weeks: WeekSummary[], rule: RewardRule, rewardCount: number, today: DateStr): RewardStatus[] {
  let n = 0;
  return weeks.map((w) => {
    const threshold = weekThreshold(w.dailyMax, rule);
    if (isWeekCleared(w, rule)) {
      n++;
      return { kind: "cleared", clearIndex: n, step: rewardStep(n, rewardCount), threshold };
    }
    if (w.finished) return { kind: "missed", threshold };
    const daysLeft = w.days.filter((r) => r.date > today).length + (w.days.some((r) => r.date === today && !r.allA) ? 1 : 0);
    const aDaysLeft = Math.max(0, rule.aDays - w.aDays);
    return {
      kind: "in_progress",
      threshold,
      pointsLeft: Math.max(0, threshold - w.score),
      aDaysLeft,
      possible: aDaysLeft <= daysLeft,
    };
  });
}

/** start〜today を含む週の月曜の一覧(古い順) */
export function weekStarts(start: DateStr, today: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let w = weekStartOf(start); w <= today; w = addDays(w, 7)) out.push(w);
  return out;
}

// ───────── 売上 ─────────

export interface SalesInput {
  month: DateStr;
  target_yen: number;
  actual_yen: number | null;
}

export interface SalesRow extends SalesInput {
  diff: number | null;
  rate: number | null;
  cumulative: number | null;
}

/** 差額 = 実績 − 目標、達成率 = 実績 ÷ 目標、累計 = その月までの実績の合計。実績が未入力の月は計算しない */
export function salesRows(rows: SalesInput[]): SalesRow[] {
  let total = 0;
  return [...rows]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => {
      if (r.actual_yen == null) return { ...r, diff: null, rate: null, cumulative: null };
      total += r.actual_yen;
      return {
        ...r,
        diff: r.actual_yen - r.target_yen,
        rate: r.target_yen ? r.actual_yen / r.target_yen : null,
        cumulative: total,
      };
    });
}

// ───────── 時刻 ─────────

/** "6:05" や "06:05:00" → 分 */
export function timeToMinutes(t: string | null | undefined): number | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 就寝時刻:12:00未満は翌日として+24時間(0:30 → 24:30) */
export function sleepMinutes(t: string | null | undefined): number | null {
  const m = timeToMinutes(t);
  return m == null ? null : m < 12 * 60 ? m + 24 * 60 : m;
}

/** 分 → "6:05" / "24:30" */
export function minutesToTime(min: number | null): string {
  if (min == null) return "—";
  const r = Math.round(min);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

export function average(xs: (number | null)[]): number | null {
  const ys = xs.filter((x): x is number => x != null);
  return ys.length ? ys.reduce((s, x) => s + x, 0) / ys.length : null;
}

/** 達成率が直近3日(昨日まで)続けて60%未満か */
export function needsMoodBoost(days: DayResult[], today: DateStr, start: DateStr): boolean {
  const byDate = new Map(days.map((r) => [r.date, r]));
  const last3 = [1, 2, 3].map((i) => addDays(today, -i));
  if (last3.some((d) => d < start)) return false;
  return last3.every((d) => {
    const r = byDate.get(d);
    return !!r && r.max > 0 && r.rate < 0.6;
  });
}

/** 表示用の % */
export function percent(rate: number | null | undefined): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}
