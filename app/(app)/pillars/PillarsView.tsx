"use client";

import { GoalsTabs } from "@/components/GoalsTabs";
import { AutoText, Loading, MoveButtons, PageTitle, btnCls, rateColor } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { pillarMatches } from "@/lib/import/sheets";
import { useRows } from "@/lib/rows";
import { average, habitRates, isActiveOn, percent } from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import type { Pillar } from "@/lib/types";

const COLORS = ["from-pink-400 to-rose-400", "from-purple-400 to-fuchsia-400", "from-sky-400 to-indigo-400", "from-amber-300 to-orange-400", "from-teal-300 to-emerald-400"];

export function PillarsView() {
  const { status, error } = useData();
  const list = useRows<Pillar>("pillars");
  if (status !== "ready" || list.status === "loading") return <Loading error={error} />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <GoalsTabs />
      <div className="flex items-center justify-between gap-2">
        <PageTitle emoji="🏛️">5つの柱</PageTitle>
        <button className={btnCls} onClick={() => list.insert({ name: "" })}>
          + 柱を追加
        </button>
      </div>
      <p className="text-sm text-purple-900/60 dark:text-purple-200/60">なぜやるのか、を見返す場所。3ヶ月ごとに見直します。</p>
      {list.rows.length === 0 && <p className="py-10 text-center text-sm text-zinc-400">まだありません。設定のインポートで「ゴール」シートを取り込めます。</p>}
      <Pillars list={list} />
    </div>
  );
}

function Pillars({ list }: { list: ReturnType<typeof useRows<Pillar>> }) {
  const { habits, checks } = useData();
  const { defs, today } = useScores();
  const rates = habitRates(defs, checks, addDays(today, -29), today);
  const defById = new Map(defs.map((d) => [d.id, d]));

  const woop: [keyof Pillar, string, string][] = [
    ["woop_wish", "W", "願望"],
    ["woop_outcome", "O", "達成したときの気分"],
    ["woop_obstacle", "O", "障害(内面の誘惑)"],
    ["woop_plan", "P", "対策(If-Then)"],
  ];
  const save = (p: Pillar, k: keyof Pillar) => (v: string) => list.update(p.id, { [k]: v });

  return (
    <div className="space-y-5">
      {list.rows.map((p, i) => {
        const linked = habits.filter((h) => (h.pillar_id === p.id || pillarMatches(p.name, h.pillar_label)) && isActiveOn(defById.get(h.id)!, today));
        const lr = linked.map((h) => ({ h, r: rates.find((x) => x.habitId === h.id)?.rate ?? null }));
        const avg = average(lr.map((x) => x.r));
        return (
          <article key={p.id} className="overflow-hidden rounded-3xl border border-pink-100 bg-white/85 shadow-[0_8px_30px_-14px_rgba(219,39,119,0.4)] backdrop-blur dark:border-purple-950 dark:bg-zinc-900/70 dark:shadow-none">
            <header className={`flex items-center gap-3 bg-gradient-to-r ${COLORS[i % COLORS.length]} px-4 py-3 text-white`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25 text-lg font-bold">{i + 1}</span>
              <AutoText value={p.name} onSave={save(p, "name")} placeholder="柱の名前" className="flex-1 [&_button]:text-white/80" inputClassName="text-lg font-bold text-zinc-900" viewClassName="!text-white" />
              <div className="shrink-0 text-right leading-tight">
                <div className="text-[10px] opacity-90">直近30日</div>
                <div className="text-xl font-bold tabular-nums">{percent(avg)}</div>
              </div>
            </header>

            <div className="space-y-4 p-4">
              <div className="rounded-2xl bg-pink-50/80 p-3 dark:bg-pink-950/30">
                <div className="mb-1 text-xs font-bold text-pink-500">💗 Why なぜ大切か</div>
                <AutoText value={p.why} onSave={save(p, "why")} multiline inputClassName="text-[15px] font-medium" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-purple-100 p-3 dark:border-purple-900">
                  <div className="mb-1 text-xs font-bold text-purple-500">🗓 3ヶ月目標</div>
                  <AutoText value={p.three_month_goal} onSave={save(p, "three_month_goal")} multiline />
                </div>
                <div className="rounded-2xl border border-purple-100 p-3 dark:border-purple-900">
                  <div className="mb-1 text-xs font-bold text-purple-500">📏 測る指標</div>
                  <AutoText value={p.metric} onSave={save(p, "metric")} />
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-bold text-purple-900/60 dark:text-purple-200/60">WOOP</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {woop.map(([k, letter, label]) => (
                    <div key={k} className="flex gap-2 rounded-2xl bg-purple-50/70 p-3 dark:bg-purple-950/30">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-sm font-bold text-white">{letter}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-purple-900/60 dark:text-purple-200/60">{label}</div>
                        <AutoText value={String(p[k] ?? "")} onSave={save(p, k)} multiline />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {lr.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-bold text-purple-900/60 dark:text-purple-200/60">この柱の習慣(直近30日)</div>
                  <ul className="space-y-1.5">
                    {lr.map(({ h, r }) => (
                      <li key={h.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{h.name}</span>
                        <span className="h-2 w-20 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <span className="block h-full rounded-full" style={{ width: `${Math.round((r ?? 0) * 100)}%`, backgroundColor: rateColor(r ?? 0) }} />
                        </span>
                        <span className="w-10 text-right text-xs tabular-nums text-zinc-500">{percent(r)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="text-xs text-zinc-400">
                <summary className="cursor-pointer select-none py-1">並べ替え・削除</summary>
                <div className="mt-2 flex justify-between">
                  <MoveButtons onUp={() => list.move(p.id, -1)} onDown={() => list.move(p.id, 1)} disabledUp={i === 0} disabledDown={i === list.rows.length - 1} />
                  <button className={`${btnCls} text-red-600`} onClick={() => confirm(`柱「${p.name}」を削除しますか?(紐づく習慣は残ります)`) && list.remove(p.id)}>
                    削除
                  </button>
                </div>
              </details>
            </div>
          </article>
        );
      })}
    </div>
  );
}
