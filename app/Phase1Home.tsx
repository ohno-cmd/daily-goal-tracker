"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Habit = { id: string; time_slot: string; time_label: string; name: string; priority: string };

export function Phase1Home() {
  const [email, setEmail] = useState<string>();
  const [habits, setHabits] = useState<Habit[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email));
    supabase
      .from("habits")
      .select("id, time_slot, time_label, name, priority")
      .order("sort_order")
      .then(({ data, error }) => (error ? setError(error.message) : setHabits(data)));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-zinc-500">ログイン中:{email ?? "…"}</span>
        <form action="/auth/signout" method="post">
          <button className="min-h-11 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700">ログアウト</button>
        </form>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {habits && (
        <p className="text-sm">
          習慣 {habits.length}件 / 満点 {habits.reduce((s, h) => s + ({ A: 3, B: 2, C: 1 } as const)[h.priority as "A"], 0)}点
        </p>
      )}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {habits?.map((h) => (
          <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-14 text-zinc-500">{h.time_label}</span>
            <span className="rounded bg-zinc-100 px-1.5 text-xs dark:bg-zinc-800">{h.priority}</span>
            <span>{h.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
