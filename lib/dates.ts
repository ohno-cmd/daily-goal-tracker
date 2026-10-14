// 日付は "yyyy-MM-dd" の文字列(Asia/Tokyo の暦日)で扱う。計算はUTCの0時に置いて行い、端末のタイムゾーンに左右されない
import { formatInTimeZone } from "date-fns-tz";

export const TZ = "Asia/Tokyo";
export type DateStr = string;

/** 日本時間の今日。サーバーもブラウザも必ずこれを通す */
export function todayInTokyo(now: Date = new Date()): DateStr {
  return formatInTimeZone(now, TZ, "yyyy-MM-dd");
}

/** 日本時間の今の時刻 "HH:mm" */
export function nowTimeInTokyo(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, "HH:mm");
}

/** 日本時間の今の時(0〜23) */
export function hourInTokyo(now: Date = new Date()): number {
  return Number(formatInTimeZone(now, TZ, "H"));
}

/** タイムスタンプ(ISO)を日本時間の暦日にする */
export function tokyoDateOf(iso: string): DateStr {
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd");
}

function toUtc(d: DateStr): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUtc(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: DateStr, n: number): DateStr {
  const t = toUtc(d);
  t.setUTCDate(t.getUTCDate() + n);
  return fromUtc(t);
}

/** b − a の日数 */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000);
}

/** a〜b(両端を含む)の各日 */
export function eachDay(a: DateStr, b: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0=日曜 … 6=土曜 */
export function weekday(d: DateStr): number {
  return toUtc(d).getUTCDay();
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** その日を含む週の月曜 */
export function weekStartOf(d: DateStr): DateStr {
  return addDays(d, -((weekday(d) + 6) % 7));
}

export function monthStartOf(d: DateStr): DateStr {
  return d.slice(0, 8) + "01";
}

export function addMonths(d: DateStr, n: number): DateStr {
  const t = toUtc(monthStartOf(d));
  t.setUTCMonth(t.getUTCMonth() + n);
  return fromUtc(t);
}

export function monthEndOf(d: DateStr): DateStr {
  return addDays(addMonths(d, 1), -1);
}

export function minDate(...ds: (DateStr | null | undefined)[]): DateStr | undefined {
  return ds.filter((d): d is DateStr => !!d).sort()[0];
}

/** "10/14(火)" */
export function formatMd(d: DateStr, withWeekday = true): string {
  const [, m, day] = d.split("-").map(Number);
  return withWeekday ? `${m}/${day}(${WEEKDAYS[weekday(d)]})` : `${m}/${day}`;
}

/** "2026年10月" */
export function formatYm(d: DateStr): string {
  const [y, m] = d.split("-").map(Number);
  return `${y}年${m}月`;
}

export function isDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtc(toUtc(s)) === s;
}
