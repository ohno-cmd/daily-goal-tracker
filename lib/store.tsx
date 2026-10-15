"use client";

// 毎日の記録(習慣・✓・日次の入力・プロフィール)をまとめて読み込み、画面間で共有する。
// ✓や入力は先に画面へ反映し、保存は裏で行う。失敗したら元に戻して知らせる
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { addDays, minDate, todayInTokyo, tokyoDateOf, type DateStr } from "./dates";
import {
  currentStreak,
  scoreDay,
  scoreDays,
  type ChecksByDate,
  type DayResult,
  type HabitDef,
} from "./scoring";
import { useToast } from "./toast";
import type { DailyEntry, EntryFields, Habit, HabitCheck, HabitVersion, Profile } from "./types";

const PAGE = 1000;

/** 1000行ずつ全部読む(Supabaseは1回の取得が最大1000行) */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

interface State {
  status: "loading" | "ready" | "error";
  error?: string;
  userId: string;
  email: string;
  profile: Profile | null;
  habits: Habit[];
  versions: HabitVersion[];
  checks: ChecksByDate;
  entries: Map<DateStr, DailyEntry>;
}

const initial: State = {
  status: "loading",
  userId: "",
  email: "",
  profile: null,
  habits: [],
  versions: [],
  checks: new Map(),
  entries: new Map(),
};

export type HabitPatch = Partial<
  Pick<Habit, "time_slot" | "time_label" | "name" | "priority" | "pillar_label" | "pillar_id" | "if_then" | "prep_20sec" | "sort_order" | "archived_at" | "active_from">
>;

interface Actions {
  reload: () => Promise<void>;
  toggleCheck: (date: DateStr, habitId: string, on: boolean) => Promise<void>;
  saveEntry: (date: DateStr, patch: Partial<EntryFields>) => Promise<boolean>;
  saveProfile: (patch: Partial<Profile>) => Promise<boolean>;
  saveHabit: (id: string, patch: HabitPatch) => Promise<boolean>;
  addHabit: (h: HabitPatch & Pick<Habit, "name" | "priority" | "time_slot">) => Promise<Habit | null>;
  reorderHabits: (ids: string[]) => Promise<void>;
}

const Ctx = createContext<(State & Actions) | null>(null);

function sortHabits(hs: Habit[]) {
  return [...hs].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const reload = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("ログインが切れました。再読み込みしてください。");
      // パートナーの行も読めるので、必ず自分の行に絞る
      const me = auth.user.id;
      const [profiles, habits, versions, checks, entries] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", me).then(({ data, error }) => {
          if (error) throw new Error(error.message);
          return data as Profile[];
        }),
        fetchAll<Habit>((f, t) => supabase.from("habits").select("*").eq("user_id", me).order("sort_order").range(f, t)),
        fetchAll<HabitVersion>((f, t) => supabase.from("habit_versions").select("*").eq("user_id", me).order("valid_from").range(f, t)),
        fetchAll<Pick<HabitCheck, "date" | "habit_id">>((f, t) =>
          supabase.from("habit_checks").select("date, habit_id").eq("user_id", me).order("date").order("id").range(f, t),
        ),
        fetchAll<DailyEntry>((f, t) => supabase.from("daily_entries").select("*").eq("user_id", me).order("date").range(f, t)),
      ]);
      let profile = profiles[0] ?? null;
      if (!profile) {
        const { data } = await supabase.from("profiles").insert({}).select().single();
        profile = data as Profile;
      }
      const byDate: ChecksByDate = new Map();
      for (const c of checks) {
        if (!byDate.has(c.date)) byDate.set(c.date, new Set());
        byDate.get(c.date)!.add(c.habit_id);
      }
      setState({
        status: "ready",
        userId: auth.user.id,
        email: auth.user.email ?? "",
        profile,
        habits: sortHabits(habits),
        versions,
        checks: byDate,
        entries: new Map(entries.map((e) => [e.date, e])),
      });
    } catch (e) {
      setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : String(e) }));
    }
  }, [supabase]);

  useEffect(() => {
    // 初回の読み込み(外部のデータを取りに行くので effect で行う)
    reload();
  }, [reload]);

  const setCheck = (date: DateStr, habitId: string, on: boolean) =>
    setState((s) => {
      const checks = new Map(s.checks);
      const set = new Set(checks.get(date));
      if (on) set.add(habitId);
      else set.delete(habitId);
      checks.set(date, set);
      return { ...s, checks };
    });

  const toggleCheck = useCallback(
    async (date: DateStr, habitId: string, on: boolean) => {
      setCheck(date, habitId, on);
      const { error } = on
        ? await supabase.from("habit_checks").upsert({ date, habit_id: habitId }, { onConflict: "user_id,date,habit_id" })
        : await supabase.from("habit_checks").delete().eq("date", date).eq("habit_id", habitId);
      if (error) {
        setCheck(date, habitId, !on);
        toast("✓を保存できませんでした。通信を確認してもう一度お試しください。");
      }
    },
    [supabase, toast],
  );

  const saveEntry = useCallback(
    async (date: DateStr, patch: Partial<EntryFields>) => {
      setState((s) => {
        const entries = new Map(s.entries);
        entries.set(date, { ...(entries.get(date) ?? emptyEntry(date)), ...patch });
        return { ...s, entries };
      });
      const { data, error } = await supabase
        .from("daily_entries")
        .upsert({ date, ...patch }, { onConflict: "user_id,date" })
        .select()
        .single();
      if (error) {
        toast("保存できませんでした。通信を確認してください。");
        return false;
      }
      setState((s) => {
        const entries = new Map(s.entries);
        // 保存中にさらに入力された値は残す
        entries.set(date, { ...(data as DailyEntry), ...pickFields(entries.get(date)) });
        return { ...s, entries };
      });
      return true;
    },
    [supabase, toast],
  );

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const prev = state.profile;
      if (!prev) return false;
      setState((s) => ({ ...s, profile: { ...s.profile!, ...patch } }));
      const { error } = await supabase.from("profiles").update(patch).eq("id", prev.id);
      if (error) {
        toast("保存できませんでした。");
        return false;
      }
      return true;
    },
    [supabase, toast, state.profile],
  );

  const refreshVersions = useCallback(async () => {
    const versions = await fetchAll<HabitVersion>((f, t) =>
      supabase.from("habit_versions").select("*").eq("user_id", state.userId).order("valid_from").range(f, t),
    );
    setState((s) => ({ ...s, versions }));
  }, [supabase, state.userId]);

  const saveHabit = useCallback(
    async (id: string, patch: HabitPatch) => {
      setState((s) => ({ ...s, habits: sortHabits(s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h))) }));
      const { error } = await supabase.from("habits").update(patch).eq("id", id);
      if (error) {
        toast("習慣を保存できませんでした。");
        await reload();
        return false;
      }
      if ("priority" in patch || "active_from" in patch) await refreshVersions();
      return true;
    },
    [supabase, toast, reload, refreshVersions],
  );

  const addHabit = useCallback(
    async (h: HabitPatch & Pick<Habit, "name" | "priority" | "time_slot">) => {
      const sort_order = Math.max(0, ...state.habits.map((x) => x.sort_order)) + 10;
      const { data, error } = await supabase
        .from("habits")
        .insert({ sort_order, ...h })
        .select()
        .single();
      if (error) {
        toast("習慣を追加できませんでした。");
        return null;
      }
      setState((s) => ({ ...s, habits: sortHabits([...s.habits, data as Habit]) }));
      await refreshVersions();
      return data as Habit;
    },
    [supabase, toast, state.habits, refreshVersions],
  );

  const reorderHabits = useCallback(
    async (ids: string[]) => {
      const order = new Map(ids.map((id, i) => [id, (i + 1) * 10]));
      setState((s) => ({
        ...s,
        habits: sortHabits(s.habits.map((h) => (order.has(h.id) ? { ...h, sort_order: order.get(h.id)! } : h))),
      }));
      const results = await Promise.all(
        ids.map((id) => supabase.from("habits").update({ sort_order: order.get(id) }).eq("id", id)),
      );
      if (results.some((r) => r.error)) {
        toast("並べ替えを保存できませんでした。");
        await reload();
      }
    },
    [supabase, toast, reload],
  );

  const value = useMemo(
    () => ({ ...state, reload, toggleCheck, saveEntry, saveProfile, saveHabit, addHabit, reorderHabits }),
    [state, reload, toggleCheck, saveEntry, saveProfile, saveHabit, addHabit, reorderHabits],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function emptyEntry(date: DateStr): DailyEntry {
  return {
    id: "",
    user_id: "",
    created_at: "",
    updated_at: "",
    date,
    wake_time: null,
    declaration: "",
    sleep_time: null,
    gratitude: "",
    memo: "",
    extra: {},
  };
}

function pickFields(e: DailyEntry | undefined): Partial<EntryFields> {
  if (!e) return {};
  const { wake_time, declaration, sleep_time, gratitude, memo } = e;
  return { wake_time, declaration, sleep_time, gratitude, memo };
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("DataProvider の中で使ってください");
  return v;
}

/** 日本時間の今日。1分ごとと、画面に戻ったときに更新する(日付をまたいで開きっぱなしでもずれない) */
export function useToday(): DateStr {
  const [today, setToday] = useState(() => todayInTokyo());
  useEffect(() => {
    const tick = () => setToday(todayInTokyo());
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}

/** 計算用の習慣の定義(優先度の履歴つき) */
export function toHabitDefs(habits: Habit[], versions: HabitVersion[]): HabitDef[] {
  const byHabit = new Map<string, HabitVersion[]>();
  for (const v of versions) byHabit.set(v.habit_id, [...(byHabit.get(v.habit_id) ?? []), v]);
  return habits.map((h) => ({
    id: h.id,
    priority: h.priority,
    pillar_label: h.pillar_label,
    active_from: h.active_from,
    archived_on: h.archived_at ? tokyoDateOf(h.archived_at) : null,
    versions: (byHabit.get(h.id) ?? [])
      .map((v) => ({ valid_from: v.valid_from, priority: v.priority }))
      .sort((a, b) => a.valid_from.localeCompare(b.valid_from)),
  }));
}

/** 見た目のテーマ */
export function useTheme(): "cute" | "cool" {
  const { profile } = useData();
  return profile?.theme === "cool" ? "cool" : "cute";
}

/** 画面に出す名前(表示名 → ログイン用の名前の順) */
export function displayNameOf(p: { display_name?: string | null; username?: string | null } | null | undefined): string {
  return p?.display_name?.trim() || p?.username?.trim() || "";
}

/** 「柱」の呼び方。term は「〇〇別」「紐づく〇〇」に、title は見出しに使う */
export function usePillarTerm() {
  const { profile } = useData();
  const term = profile?.pillar_term?.trim() || "柱";
  return { term, title: term === "柱" ? "5つの柱" : term };
}

/** 習慣・✓・記録から、集計に使う値をまとめて作る(自分の分にもパートナーの分にも使う) */
export function computeScores(
  habits: Habit[],
  versions: HabitVersion[],
  checks: ChecksByDate,
  entries: Map<DateStr, DailyEntry>,
  startedOn: DateStr | undefined,
  today: DateStr,
) {
  const defs = toHabitDefs(habits, versions);
  const firstData = [...checks.keys(), ...entries.keys()].sort()[0];
  const start = minDate(startedOn, firstData) ?? today;
  const days: DayResult[] = scoreDays(defs, checks, start, today);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const day = (d: DateStr) => byDate.get(d) ?? scoreDay(defs, checks.get(d), d);
  const streak = currentStreak((d) => day(d).allA, today, start);
  return { defs, start, today, days, day, streak, yesterday: addDays(today, -1) };
}

export type Scores = ReturnType<typeof computeScores>;

/** 自分の集計 */
export function useScores(): Scores {
  const { habits, versions, checks, entries, profile } = useData();
  const today = useToday();
  return useMemo(() => computeScores(habits, versions, checks, entries, profile?.started_on, today), [habits, versions, checks, entries, profile?.started_on, today]);
}
