"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Loading, PriorityBadge, btnCls, rateColor } from "@/components/ui";
import { ReviewTabs } from "@/components/ReviewTabs";
import { addDays, addMonths, eachDay, formatMd, formatYm, monthEndOf, monthStartOf, weekStartOf, WEEKDAYS, weekday, type DateStr } from "@/lib/dates";
import { isActiveOn, percent, priorityOn } from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import { TIME_SLOTS } from "@/lib/types";

type Mode = "calendar" | "week" | "month";

export function HistoryView() {
  const { status, error } = useData();
  const { today } = useScores();
  const [month, setMonth] = useState<DateStr>(() => monthStartOf(today));
  const [week, setWeek] = useState<DateStr>(() => weekStartOf(today));
  const [mode, setMode] = useState<Mode>("calendar");
  if (status !== "ready") return <Loading error={error} />;

  return (
    <div className="space-y-4">
      <ReviewTabs />
      <div className="hidden gap-1 md:flex">
        {(
          [
            ["calendar", "カレンダー"],
            ["week", "表(1週間)"],
            ["month", "表(1ヶ月)"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`${btnCls} ${mode === m ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "week" ? (
        <>
          <Pager label={`${formatMd(week)} 〜 ${formatMd(addDays(week, 6))}`} onPrev={() => setWeek(addDays(week, -7))} onNext={() => setWeek(addDays(week, 7))} />
          <div className="hidden md:block">
            <HabitTable from={week} to={addDays(week, 6)} />
          </div>
        </>
      ) : (
        <>
          <Pager label={formatYm(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} />
          {mode === "month" && (
            <div className="hidden md:block">
              <HabitTable from={month} to={monthEndOf(month)} />
            </div>
          )}
          <div className={mode === "month" ? "md:hidden" : ""}>
            <MonthGrid month={month} />
          </div>
        </>
      )}
    </div>
  );
}

function Pager({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <button className={btnCls} onClick={onPrev} aria-label="前へ">
        ‹
      </button>
      <div className="font-bold">{label}</div>
      <button className={btnCls} onClick={onNext} aria-label="次へ">
        ›
      </button>
    </div>
  );
}

/** 月表示。達成率で色分けし、A全達成の日に◎ */
function MonthGrid({ month }: { month: DateStr }) {
  const { day, today, start } = useScores();
  const first = weekStartOf(month);
  const last = addDays(weekStartOf(monthEndOf(month)), 6);
  const cells = eachDay(first, last);
  return (
    <Card className="mx-auto max-w-xl !p-2 sm:!p-4">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <div key={w} className={w === 0 ? "text-rose-500" : w === 6 ? "text-sky-600" : ""}>
            {WEEKDAYS[w]}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const r = day(d);
          const scored = d <= today && d >= start && r.max > 0;
          return (
            <Link
              key={d}
              href={d === today ? "/" : `/?d=${d}`}
              data-date={d}
              className={`relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg text-sm ${inMonth ? "" : "opacity-30"} ${
                d === today ? "ring-2 ring-purple-500" : ""
              } ${scored ? "text-zinc-900" : "bg-zinc-50 text-zinc-400 dark:bg-zinc-900"}`}
              style={scored ? { backgroundColor: rateColor(r.rate) } : undefined}
              title={scored ? `${formatMd(d)} ${r.score}/${r.max} ${percent(r.rate)}` : formatMd(d)}
            >
              <span className="font-semibold tabular-nums">{Number(d.slice(8))}</span>
              {scored && <span className="text-[10px] leading-none tabular-nums">{r.allA ? "◎" : percent(r.rate)}</span>}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-zinc-500">
        0%
        <span className="h-2 w-32 rounded-full" style={{ background: `linear-gradient(to right, ${rateColor(0)}, ${rateColor(0.6)}, ${rateColor(1)})` }} />
        100% ・ ◎=A全達成
      </div>
    </Card>
  );
}

/** PC用:日付が横、習慣が縦の表。セルをクリックして✓を付け外しできる */
function HabitTable({ from, to }: { from: DateStr; to: DateStr }) {
  const { habits, checks, toggleCheck } = useData();
  const { defs, day, today } = useScores();
  const dates = eachDay(from, to);
  const defById = new Map(defs.map((d) => [d.id, d]));
  const rows = habits.filter((h) => dates.some((d) => isActiveOn(defById.get(h.id)!, d) || checks.get(d)?.has(h.id)));
  const dense = dates.length > 10;

  return (
    <Card className="!p-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium dark:bg-zinc-900">習慣</th>
            {dates.map((d) => (
              <th key={d} className={`px-0.5 py-2 text-center font-normal ${weekday(d) === 0 ? "text-rose-500" : weekday(d) === 6 ? "text-sky-600" : "text-zinc-500"}`}>
                <Link href={d === today ? "/" : `/?d=${d}`} className="block text-xs leading-tight hover:underline">
                  {dense ? Number(d.slice(8)) : formatMd(d, false)}
                  <br />
                  {WEEKDAYS[weekday(d)]}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((slot) =>
            rows
              .filter((h) => h.time_slot === slot.value)
              .map((h, i) => (
                <tr key={h.id} className={`border-b border-zinc-100 dark:border-zinc-800 ${i === 0 ? "border-t-2 border-t-zinc-200 dark:border-t-zinc-700" : ""}`}>
                  <th className="sticky left-0 z-10 max-w-64 bg-white px-3 py-1 text-left font-normal dark:bg-zinc-900">
                    <span className="flex items-center gap-2">
                      <PriorityBadge p={priorityOn(defById.get(h.id)!, today)} />
                      <span className="truncate">{h.name}</span>
                    </span>
                  </th>
                  {dates.map((d) => {
                    const active = isActiveOn(defById.get(h.id)!, d);
                    const on = checks.get(d)?.has(h.id) ?? false;
                    const disabled = d > today || (!active && !on);
                    return (
                      <td key={d} className="p-0 text-center">
                        <button
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${formatMd(d)} ${h.name}`}
                          disabled={disabled}
                          onClick={() => toggleCheck(d, h.id, !on)}
                          className={`h-9 w-full ${dense ? "min-w-7" : "min-w-11"} ${disabled ? "bg-zinc-50 dark:bg-zinc-900/40" : "hover:bg-purple-50 dark:hover:bg-purple-950"} ${on ? "font-bold text-purple-600" : "text-zinc-300"}`}
                        >
                          {on ? "✓" : disabled ? "" : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              )),
          )}
        </tbody>
        <tfoot className="border-t-2 border-zinc-200 text-xs dark:border-zinc-700">
          {(
            [
              ["点数", (d: DateStr) => `${day(d).score}/${day(d).max}`],
              ["達成率", (d: DateStr) => percent(day(d).rate)],
              ["A全達成", (d: DateStr) => (day(d).allA ? "◎" : "")],
            ] as const
          ).map(([label, f]) => (
            <tr key={label}>
              <th className="sticky left-0 bg-white px-3 py-1 text-left font-medium dark:bg-zinc-900">{label}</th>
              {dates.map((d) => (
                <td key={d} className="px-0.5 py-1 text-center tabular-nums text-zinc-600 dark:text-zinc-400">
                  {d <= today ? f(d) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>
    </Card>
  );
}
