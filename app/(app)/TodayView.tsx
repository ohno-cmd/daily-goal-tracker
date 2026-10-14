"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AutoText, Card, Loading, PriorityBadge, btnCls, inputCls } from "@/components/ui";
import { addDays, formatMd, isDateStr, nowTimeInTokyo, type DateStr } from "@/lib/dates";
import { needsMoodBoost, percent, priorityOn, isActiveOn } from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import { TIME_SLOTS, type Habit } from "@/lib/types";

export function TodayView() {
  const data = useData();
  const scores = useScores();
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("d");
  const date: DateStr = q && isDateStr(q) ? q : scores.today;

  if (data.status !== "ready") return <Loading error={data.error} />;

  const go = (d: DateStr) => router.push(d === scores.today ? "/" : `/?d=${d}`);
  return <Day key={date} date={date} go={go} />;
}

function Day({ date, go }: { date: DateStr; go: (d: DateStr) => void }) {
  const { habits, checks, entries, toggleCheck, saveEntry } = useData();
  const { defs, today, day, streak, days, start } = useScores();
  const isFuture = date > today;
  const isToday = date === today;
  const r = day(date);
  const entry = entries.get(date);
  const checked = checks.get(date) ?? new Set<string>();
  const [open, setOpen] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const prevAllA = useRef(r.allA);
  const userToggled = useRef(false);

  // 優先度Aが全部✓になった瞬間にお祝いを出す
  useEffect(() => {
    if (r.allA && !prevAllA.current && userToggled.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2200);
      prevAllA.current = r.allA;
      return () => clearTimeout(t);
    }
    prevAllA.current = r.allA;
  }, [r.allA]);

  const defById = new Map(defs.map((d) => [d.id, d]));
  const visible = habits.filter((h) => {
    const d = defById.get(h.id);
    return d && (isActiveOn(d, date) || checked.has(h.id));
  });
  const moodBoost = isToday && needsMoodBoost(days, today, start);

  function toggle(h: Habit) {
    if (isFuture) return;
    userToggled.current = true;
    toggleCheck(date, h.id, !checked.has(h.id));
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* 上部:日付と今日の点数 */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-zinc-200 bg-white/95 px-4 pb-3 pt-1 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-2">
          <button className={btnCls} aria-label="前の日" onClick={() => go(addDays(date, -1))}>
            ‹
          </button>
          <div className="text-center">
            <div className="text-lg font-bold">
              {formatMd(date)}
              {isToday && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">今日</span>}
            </div>
            {!isToday && (
              <button className="text-xs text-emerald-600 underline" onClick={() => go(today)}>
                今日に戻る
              </button>
            )}
          </div>
          <button className={btnCls} aria-label="次の日" onClick={() => go(addDays(date, 1))}>
            ›
          </button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <Mini label="点数" value={<><span data-testid="score">{r.score}</span><span className="text-sm font-normal text-zinc-500"> / {r.max}</span></>} />
          <Mini label="達成率" value={<span data-testid="rate">{percent(r.rate)}</span>} />
          <Mini
            label="A全達成"
            value={<span data-testid="allA" className={r.allA ? "text-emerald-600" : "text-zinc-300 dark:text-zinc-600"}>{r.allA ? "◎" : `${r.aChecked}/${r.aTotal}`}</span>}
          />
          <Mini label="連続" value={<><span data-testid="streak">{streak}</span><span className="text-sm font-normal text-zinc-500">日</span></>} />
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round(r.rate * 100)}%` }} />
        </div>
      </div>

      {moodBoost && (
        <Link href="/settings#mood" className="block text-center text-xs text-zinc-500 underline">
          ここ3日は60%に届いていません。気分転換リストを見る
        </Link>
      )}
      {isFuture && <p className="text-center text-xs text-zinc-500">未来の日は、宣言とメモだけ書けます。</p>}

      <Card>
        <TimeField label="起床時刻" value={entry?.wake_time ?? null} disabled={isFuture} onSave={(v) => saveEntry(date, { wake_time: v })} />
      </Card>

      <Card>
        <AutoText
          label="今日の宣言"
          multiline
          value={entry?.declaration ?? ""}
          onSave={(v) => saveEntry(date, { declaration: v })}
          placeholder="今日やり遂げること"
        />
      </Card>

      {TIME_SLOTS.map((slot) => {
        const list = visible.filter((h) => h.time_slot === slot.value);
        if (!list.length) return null;
        return (
          <Card key={slot.value} className="!p-0">
            <h2 className="px-4 pb-1 pt-3 text-sm font-bold text-zinc-500">{slot.label}</h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {list.map((h) => {
                const d = defById.get(h.id)!;
                const on = checked.has(h.id);
                const expanded = open === h.id;
                return (
                  <li key={h.id}>
                    <div className="flex items-center gap-2 pl-4 pr-2">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-500">{h.time_label}</span>
                      <PriorityBadge p={priorityOn(d, date)} />
                      <button
                        className={`min-h-12 flex-1 py-2 text-left text-[15px] leading-snug ${on ? "text-zinc-400 line-through decoration-zinc-300 dark:decoration-zinc-600" : ""}`}
                        onClick={() => setOpen(expanded ? null : h.id)}
                        aria-expanded={expanded}
                      >
                        {h.name}
                      </button>
                      <button
                        role="checkbox"
                        aria-checked={on}
                        aria-label={h.name}
                        disabled={isFuture}
                        onClick={() => toggle(h)}
                        className="flex h-12 w-12 shrink-0 items-center justify-center disabled:opacity-30"
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-lg font-bold transition ${
                            on ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 text-transparent dark:border-zinc-600"
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    </div>
                    {expanded && (
                      <div className="space-y-2 bg-zinc-50 px-4 py-3 text-sm dark:bg-zinc-900">
                        <Detail label="If-Then" text={h.if_then} />
                        <Detail label="20秒の準備" text={h.prep_20sec} />
                        {h.name.includes("アファメーション") && (
                          <Link href="/affirmation" className="inline-block text-emerald-600 underline">
                            アファメーションを読む
                          </Link>
                        )}
                        <Link href={`/settings?habit=${h.id}#habits`} className="block text-xs text-zinc-500 underline">
                          この習慣を編集
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      <Card>
        <TimeField label="就寝時刻" value={entry?.sleep_time ?? null} disabled={isFuture} onSave={(v) => saveEntry(date, { sleep_time: v })} />
      </Card>

      <Card>
        <AutoText
          label="感謝・できたこと3つ"
          multiline
          disabled={isFuture}
          value={entry?.gratitude ?? ""}
          onSave={(v) => saveEntry(date, { gratitude: v })}
        />
      </Card>

      <Card>
        <AutoText label="メモ(TODOなど)" multiline rows={4} value={entry?.memo ?? ""} onSave={(v) => saveEntry(date, { memo: v })} />
      </Card>

      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="animate-[pop_2.2s_ease-out_forwards] rounded-3xl bg-emerald-600 px-8 py-6 text-center text-white shadow-2xl">
            <div className="text-6xl leading-none">◎</div>
            <div className="mt-2 text-lg font-bold">A全達成!</div>
            <div className="text-sm opacity-90">連続 {streak}日</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-zinc-500">{label}</div>
      <div className="whitespace-pre-wrap">{text || <span className="text-zinc-400">未設定</span>}</div>
    </div>
  );
}

/** 時刻の入力。「今」で日本時間の現在時刻を入れる */
function TimeField({
  label,
  value,
  disabled,
  onSave,
}: {
  label: string;
  value: string | null;
  disabled?: boolean;
  onSave: (v: string | null) => Promise<boolean>;
}) {
  const v = value ? value.slice(0, 5) : "";
  const [saved, setSaved] = useState(false);
  async function save(next: string) {
    const ok = await onSave(next || null);
    setSaved(ok);
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        {label}
        {saved && <span className="text-xs text-zinc-400">保存済み</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="time"
          aria-label={label}
          value={v}
          disabled={disabled}
          onChange={(e) => save(e.target.value)}
          className={`${inputCls} flex-1 text-lg tabular-nums`}
        />
        <button type="button" className={btnCls} disabled={disabled} onClick={() => save(nowTimeInTokyo())}>
          今
        </button>
      </div>
    </div>
  );
}
