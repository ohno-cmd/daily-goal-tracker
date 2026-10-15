"use client";

// パートナーの「今日」を読むだけのデータ。RLS(can_view)でパートナーの行だけ読める
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "./supabase/client";
import { fetchAll } from "./store";
import type { ChecksByDate } from "./scoring";
import type { DailyEntry, Habit, HabitCheck, HabitVersion, Profile } from "./types";

export interface PartnerInfo {
  id: string;
  name: string;
  startedOn: string;
}

/** パートナーがいれば、その名前など */
export function usePartner(): { partner: PartnerInfo | null; loading: boolean } {
  const sb = useMemo(() => createClient(), []);
  const [state, setState] = useState<{ partner: PartnerInfo | null; loading: boolean }>({ partner: null, loading: true });
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const { data: links } = await sb.from("partners").select("partner_id").eq("user_id", auth.user?.id ?? "").limit(1);
      const id = links?.[0]?.partner_id as string | undefined;
      if (!id) return alive && setState({ partner: null, loading: false });
      const { data: p } = await sb.from("profiles").select("username, display_name, started_on").eq("user_id", id).single();
      const prof = p as Pick<Profile, "username" | "display_name" | "started_on"> | null;
      const name = prof?.display_name?.trim() || prof?.username?.trim() || "パートナー";
      if (alive) setState({ partner: { id, name, startedOn: prof?.started_on ?? "" }, loading: false });
    })();
    return () => {
      alive = false;
    };
  }, [sb]);
  return state;
}

export interface PartnerData {
  status: "loading" | "ready" | "error";
  habits: Habit[];
  versions: HabitVersion[];
  checks: ChecksByDate;
  entries: Map<string, DailyEntry>;
}

/** パートナーの習慣・✓・日次の記録。1分ごとと、画面に戻ったときに読み直す */
export function usePartnerData(partnerId: string): PartnerData {
  const sb = useMemo(() => createClient(), []);
  const [data, setData] = useState<PartnerData>({ status: "loading", habits: [], versions: [], checks: new Map(), entries: new Map() });

  const load = useCallback(async () => {
    try {
      const [habits, versions, checks, entries] = await Promise.all([
        fetchAll<Habit>((f, t) => sb.from("habits").select("*").eq("user_id", partnerId).order("sort_order").range(f, t)),
        fetchAll<HabitVersion>((f, t) => sb.from("habit_versions").select("*").eq("user_id", partnerId).order("valid_from").range(f, t)),
        fetchAll<Pick<HabitCheck, "date" | "habit_id">>((f, t) => sb.from("habit_checks").select("date, habit_id").eq("user_id", partnerId).order("date").order("id").range(f, t)),
        fetchAll<DailyEntry>((f, t) => sb.from("daily_entries").select("*").eq("user_id", partnerId).order("date").range(f, t)),
      ]);
      const byDate: ChecksByDate = new Map();
      for (const c of checks) {
        if (!byDate.has(c.date)) byDate.set(c.date, new Set());
        byDate.get(c.date)!.add(c.habit_id);
      }
      setData({ status: "ready", habits, versions, checks: byDate, entries: new Map(entries.map((e) => [e.date, e])) });
    } catch {
      setData((d) => ({ ...d, status: "error" }));
    }
  }, [sb, partnerId]);

  useEffect(() => {
    // 表示したときに読み込む(state の更新は読み込みが終わってから)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 60_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);
  return data;
}
