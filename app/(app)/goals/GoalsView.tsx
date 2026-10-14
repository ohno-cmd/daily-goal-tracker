"use client";

import Link from "next/link";
import { useState } from "react";
import { SalesChart } from "@/components/charts";
import { AutoText, Card, Loading, MoveButtons, SectionTitle, Stat, btnCls, yen } from "@/components/ui";
import { addDays, addMonths, formatYm, monthStartOf, type DateStr } from "@/lib/dates";
import { parseYen, pillarMatches } from "@/lib/import/sheets";
import { useRows } from "@/lib/rows";
import { average, habitRates, isActiveOn, percent, salesRows } from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import type { Benefactor, MonthlySales, Pillar } from "@/lib/types";

export function GoalsView() {
  const { status, error } = useData();
  const pillars = useRows<Pillar>("pillars");
  if (status !== "ready") return <Loading error={error} />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">目標の全体像</h1>
      <Hierarchy pillars={pillars.rows} />
      <Benefactors />
      <Sales />
      <Pillars list={pillars} />
    </div>
  );
}

/** 最終目標 → 中間目標 → 3ヶ月目標 → 毎日の習慣 */
function Hierarchy({ pillars }: { pillars: Pillar[] }) {
  const { profile, saveProfile, habits } = useData();
  const active = habits.filter((h) => !h.archived_at);
  const step = (n: number, title: string, body: React.ReactNode) => (
    <div className="relative pl-9">
      <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{n}</span>
      <div className="mb-1 text-sm font-semibold">{title}</div>
      {body}
    </div>
  );
  return (
    <Card>
      <div className="space-y-4">
        {step(1, "最終目標", <AutoText multiline rows={2} value={profile?.final_goal ?? ""} onSave={(v) => saveProfile({ final_goal: v })} />)}
        {step(2, "中間目標", <AutoText multiline rows={2} value={profile?.mid_goal ?? ""} onSave={(v) => saveProfile({ mid_goal: v })} />)}
        {step(
          3,
          "3ヶ月目標",
          <div className="space-y-2">
            <AutoText multiline rows={2} value={profile?.three_month_note ?? ""} onSave={(v) => saveProfile({ three_month_note: v })} placeholder="全体の3ヶ月目標" />
            {pillars.some((p) => p.three_month_goal) && (
              <ul className="space-y-1 text-sm">
                {pillars
                  .filter((p) => p.three_month_goal)
                  .map((p) => (
                    <li key={p.id}>
                      <span className="text-zinc-500">{p.name}:</span>
                      {p.three_month_goal}
                    </li>
                  ))}
              </ul>
            )}
          </div>,
        )}
        {step(
          4,
          "毎日の習慣",
          <p className="text-sm">
            {active.length}個(A {active.filter((h) => h.priority === "A").length}・B {active.filter((h) => h.priority === "B").length}・C{" "}
            {active.filter((h) => h.priority === "C").length})
            <Link href="/" className="ml-2 text-emerald-600 underline">
              今日の✓へ
            </Link>
          </p>,
        )}
      </div>
    </Card>
  );
}

function Benefactors() {
  const list = useRows<Benefactor>("benefactors");
  const fields: [keyof Benefactor, string][] = [
    ["relation", "関係"],
    ["received", "受けた恩"],
    ["plan", "恩返しの形"],
    ["progress", "今の進み具合"],
    ["next_action", "次にやること"],
  ];
  return (
    <Card>
      <SectionTitle right={<button className={btnCls} onClick={() => list.insert({ name: "" })}>+ 追加</button>}>恩返ししたい人</SectionTitle>
      {list.rows.length === 0 && <p className="text-sm text-zinc-400">まだいません</p>}
      <div className="space-y-3">
        {list.rows.map((b, i) => (
          <details key={b.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800" open={!b.name}>
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-3 py-2">
              <span className="font-semibold">{b.name || "(名前未入力)"}</span>
              <span className="text-xs text-zinc-500">{b.relation}</span>
              <span className="ml-auto truncate text-xs text-zinc-500">{b.next_action && `次:${b.next_action}`}</span>
            </summary>
            <div className="space-y-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
              <AutoText label="名前" value={b.name} onSave={(v) => list.update(b.id, { name: v })} />
              {fields.map(([k, label]) => (
                <AutoText key={k} label={label} multiline rows={2} value={String(b[k] ?? "")} onSave={(v) => list.update(b.id, { [k]: v })} />
              ))}
              <div className="flex justify-between">
                <MoveButtons onUp={() => list.move(b.id, -1)} onDown={() => list.move(b.id, 1)} disabledUp={i === 0} disabledDown={i === list.rows.length - 1} />
                <button className={`${btnCls} text-red-600`} onClick={() => confirm(`「${b.name || "この行"}」を削除しますか?`) && list.remove(b.id)}>
                  削除
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}

function Sales() {
  const { today, start } = useScores();
  const sales = useRows<MonthlySales & { sort_order?: number }>("monthly_sales", "month");
  const [extra, setExtra] = useState(0);
  const thisMonth = monthStartOf(today);
  const earliest = [monthStartOf(start), ...sales.rows.map((r) => r.month)].sort()[0];
  const first = addMonths(earliest, -extra);
  const months: DateStr[] = [];
  for (let m = first; m <= thisMonth; m = addMonths(m, 1)) months.push(m);
  for (const r of sales.rows) if (!months.includes(r.month)) months.push(r.month);
  months.sort();

  const byMonth = new Map(sales.rows.map((r) => [r.month, r]));
  const computed = salesRows(months.map((m) => ({ month: m, target_yen: byMonth.get(m)?.target_yen ?? 3_000_000, actual_yen: byMonth.get(m)?.actual_yen ?? null })));
  const withActual = computed.filter((r) => r.actual_yen != null);
  const save = (month: DateStr, patch: Partial<MonthlySales>) => sales.upsert({ month, ...patch }, "user_id,month").then((r) => !!r);

  return (
    <Card id="sales">
      <SectionTitle right={<button className={btnCls} onClick={() => setExtra(extra + 1)}>+ 前の月</button>}>月次売上</SectionTitle>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="目標達成月数" value={`${withActual.filter((r) => r.actual_yen! >= r.target_yen).length}か月`} sub={`実績入力 ${withActual.length}か月`} />
        <Stat label="平均達成率" value={percent(average(withActual.map((r) => r.rate)))} />
        <Stat label="累計実績" value={yen(withActual.at(-1)?.cumulative ?? null)} />
      </div>
      {withActual.length > 0 && <SalesChart data={computed.map((r) => ({ month: r.month, target: r.target_yen, actual: r.actual_yen }))} />}
      <div className="mt-4 space-y-3">
        {[...computed].reverse().map((r) => {
          const row = byMonth.get(r.month);
          return (
            <details key={r.month} className="rounded-xl border border-zinc-200 dark:border-zinc-800" open={r.month === thisMonth}>
              <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 px-3 py-2 text-sm">
                <span className="font-semibold">{formatYm(r.month)}</span>
                <span>{yen(r.actual_yen)}</span>
                {r.rate != null && <span className={r.rate >= 1 ? "font-semibold text-emerald-600" : "text-zinc-500"}>{percent(r.rate)}</span>}
              </summary>
              <div className="space-y-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                <div className="grid grid-cols-2 gap-2">
                  <AutoText label="目標(円)" value={String(r.target_yen)} onSave={(v) => save(r.month, { target_yen: parseYen(v) ?? 3_000_000 })} inputClassName="tabular-nums" />
                  <AutoText
                    label="実績(円)"
                    value={r.actual_yen == null ? "" : String(r.actual_yen)}
                    onSave={(v) => save(r.month, { actual_yen: parseYen(v) })}
                    inputClassName="tabular-nums"
                    placeholder="未入力"
                  />
                </div>
                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-50 p-2 text-center text-sm dark:bg-zinc-900" data-testid={`sales-${r.month}`}>
                  <div>
                    <dt className="text-xs text-zinc-500">差額</dt>
                    <dd className={`tabular-nums ${r.diff != null && r.diff < 0 ? "text-red-600" : ""}`}>{r.diff == null ? "—" : `${r.diff > 0 ? "+" : r.diff < 0 ? "−" : ""}${Math.abs(r.diff).toLocaleString("ja-JP")}円`}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">達成率</dt>
                    <dd className="tabular-nums">{percent(r.rate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">累計</dt>
                    <dd className="tabular-nums">{yen(r.cumulative)}</dd>
                  </div>
                </dl>
                <AutoText label="うまくいったこと" multiline rows={2} value={row?.went_well ?? ""} onSave={(v) => save(r.month, { went_well: v })} />
                <AutoText label="課題" multiline rows={2} value={row?.issues ?? ""} onSave={(v) => save(r.month, { issues: v })} />
                <AutoText label="来月の打ち手" multiline rows={2} value={row?.next_actions ?? ""} onSave={(v) => save(r.month, { next_actions: v })} />
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}

function Pillars({ list }: { list: ReturnType<typeof useRows<Pillar>> }) {
  const { habits, checks } = useData();
  const { defs, today } = useScores();
  const from = addDays(today, -29);
  const rates = habitRates(defs, checks, from, today);
  const defById = new Map(defs.map((d) => [d.id, d]));

  const fields: [keyof Pillar, string, boolean][] = [
    ["why", "Why", true],
    ["three_month_goal", "3ヶ月目標", true],
    ["metric", "測る指標", false],
    ["woop_wish", "W 願望", true],
    ["woop_outcome", "O 達成したときの気分", true],
    ["woop_obstacle", "O 障害", true],
    ["woop_plan", "P 対策", true],
  ];

  return (
    <Card id="pillars">
      <SectionTitle right={<button className={btnCls} onClick={() => list.insert({ name: "" })}>+ 柱を追加</button>}>5つの柱</SectionTitle>
      {list.rows.length === 0 && <p className="text-sm text-zinc-400">まだありません。設定のインポートで「ゴール」シートを取り込めます。</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {list.rows.map((p, i) => {
          const linked = habits.filter((h) => (h.pillar_id === p.id || pillarMatches(p.name, h.pillar_label)) && isActiveOn(defById.get(h.id)!, today));
          const lr = linked.map((h) => ({ h, r: rates.find((x) => x.habitId === h.id)?.rate ?? null }));
          const avg = average(lr.map((x) => x.r));
          return (
            <section key={p.id} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <AutoText value={p.name} onSave={(v) => list.update(p.id, { name: v })} placeholder="柱の名前" className="flex-1" inputClassName="font-bold" />
                <span className="shrink-0 text-right text-xs text-zinc-500">
                  直近30日
                  <br />
                  <b className="text-lg text-zinc-900 dark:text-zinc-100">{percent(avg)}</b>
                </span>
              </div>
              {lr.length > 0 && (
                <ul className="space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {lr.map(({ h, r }) => (
                    <li key={h.id} className="flex justify-between gap-2">
                      <span className="truncate">{h.name}</span>
                      <span className="tabular-nums">{percent(r)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {fields.map(([k, label, multi]) => (
                <AutoText key={k} label={label} multiline={multi} rows={k === "woop_obstacle" || k === "woop_plan" ? 3 : 2} value={String(p[k] ?? "")} onSave={(v) => list.update(p.id, { [k]: v })} />
              ))}
              <div className="flex justify-between">
                <MoveButtons onUp={() => list.move(p.id, -1)} onDown={() => list.move(p.id, 1)} disabledUp={i === 0} disabledDown={i === list.rows.length - 1} />
                <button className={`${btnCls} text-red-600`} onClick={() => confirm(`柱「${p.name}」を削除しますか?(紐づく習慣は残ります)`) && list.remove(p.id)}>
                  削除
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
