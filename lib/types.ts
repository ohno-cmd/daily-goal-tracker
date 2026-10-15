// DBの行の型(supabase/migrations と合わせる)
import type { Priority } from "./scoring";

export type TimeSlot = "morning" | "daytime" | "night";
export const TIME_SLOTS: { value: TimeSlot; label: string }[] = [
  { value: "morning", label: "朝" },
  { value: "daytime", label: "日中" },
  { value: "night", label: "夜" },
];

interface Row {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile extends Row {
  display_name: string;
  /** ログイン用の名前 */
  username: string | null;
  /** 「柱」の呼び方(例:大切な軸) */
  pillar_term: string;
  /** 見た目(cute:かわいい / cool:かっこいい) */
  theme: "cute" | "cool";
  final_goal: string;
  mid_goal: string;
  three_month_note: string;
  reward_rate: number;
  reward_a_days: number;
  started_on: string;
}

export interface Pillar extends Row {
  name: string;
  why: string;
  three_month_goal: string;
  metric: string;
  woop_wish: string;
  woop_outcome: string;
  woop_obstacle: string;
  woop_plan: string;
  sort_order: number;
}

export interface Habit extends Row {
  time_slot: TimeSlot;
  time_label: string;
  name: string;
  priority: Priority;
  pillar_label: string;
  pillar_id: string | null;
  if_then: string;
  prep_20sec: string;
  sort_order: number;
  active_from: string;
  archived_at: string | null;
}

export interface DailyEntry extends Row {
  date: string;
  wake_time: string | null;
  declaration: string;
  sleep_time: string | null;
  gratitude: string;
  memo: string;
  extra: Record<string, unknown>;
}

export interface HabitCheck extends Row {
  date: string;
  habit_id: string;
  checked_at: string;
}

export interface HabitVersion extends Row {
  habit_id: string;
  priority: Priority;
  valid_from: string;
}

export interface Benefactor extends Row {
  name: string;
  relation: string;
  received: string;
  plan: string;
  progress: string;
  next_action: string;
  sort_order: number;
}

export interface MonthlySales extends Row {
  month: string;
  target_yen: number;
  actual_yen: number | null;
  went_well: string;
  issues: string;
  next_actions: string;
}

export interface WeeklyReview extends Row {
  week_start: string;
  worst_habit_id: string | null;
  cause: string;
  if_then_fix: string;
  next_big_rock: string;
}

export interface Reward extends Row {
  step: number;
  text: string;
}

export interface TextItem extends Row {
  text: string;
  sort_order: number;
}

export type EntryFields = Pick<DailyEntry, "wake_time" | "declaration" | "sleep_time" | "gratitude" | "memo">;
