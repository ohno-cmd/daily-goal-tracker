"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AutoText, Card, Loading, PencilButton, PriorityBadge, btnCls, inputCls, primaryBtnCls } from "@/components/ui";
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

const SLOT_EMOJI: Record<string, string> = { morning: "☀️", daytime: "🌤", night: "🌙" };

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
      <div className="sticky top-2 z-30 rounded-3xl border border-pink-100 bg-white/90 p-3 shadow-[0_8px_30px_-14px_rgba(219,39,119,0.45)] backdrop-blur dark:border-purple-950 dark:bg-zinc-900/90 dark:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <button className={btnCls} aria-label="前の日" onClick={() => go(addDays(date, -1))}>
            ‹
          </button>
          <div className="text-center">
            <div className="text-lg font-bold">
              {formatMd(date)}
              {isToday && <span className="ml-2 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 px-2 py-0.5 text-xs text-white">今日</span>}
            </div>
            {!isToday && (
              <button className="text-xs font-bold text-purple-600 underline" onClick={() => go(today)}>
                今日に戻る
              </button>
            )}
          </div>
          <button className={btnCls} aria-label="次の日" onClick={() => go(addDays(date, 1))}>
            ›
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Ring rate={r.rate} />
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <Mini
              label="点数"
              value={
                <>
                  <span data-testid="score">{r.score}</span>
                  <span className="text-sm font-normal text-zinc-400"> / {r.max}</span>
                </>
              }
            />
            <Mini
              label="A全達成"
              value={
                <span data-testid="allA" className={r.allA ? "bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent" : "text-zinc-300 dark:text-zinc-600"}>
                  {r.allA ? "◎" : `${r.aChecked}/${r.aTotal}`}
                </span>
              }
            />
            <Mini
              label="連続"
              value={
                <>
                  <span aria-hidden className={streak ? "" : "opacity-40 grayscale"}>
                    🔥
                  </span>
                  <span data-testid="streak">{streak}</span>
                  <span className="text-sm font-normal text-zinc-400">日</span>
                </>
              }
            />
          </div>
        </div>
      </div>

      {moodBoost && (
        <Link href="/settings#mood" className="block rounded-2xl bg-white/70 p-3 text-center text-xs text-purple-900/70 dark:bg-zinc-900/60 dark:text-purple-200/70">
          🌈 ここ3日は60%に届いていません。気分転換リストを見る ›
        </Link>
      )}
      {isFuture && <p className="text-center text-xs text-zinc-500">未来の日は、宣言とメモだけ書けます。</p>}

      <Card>
        <TimeField emoji="☀️" label="起床時刻" value={entry?.wake_time ?? null} disabled={isFuture} onSave={(v) => saveEntry(date, { wake_time: v })} />
      </Card>

      <Card>
        <AutoText
          label="📣 今日の宣言"
          multiline
          value={entry?.declaration ?? ""}
          onSave={(v) => saveEntry(date, { declaration: v })}
          empty="今日やり遂げることを書く"
          inputClassName="text-[15px] font-medium"
        />
      </Card>

      {TIME_SLOTS.map((slot) => {
        const list = visible.filter((h) => h.time_slot === slot.value);
        if (!list.length) return null;
        const done = list.filter((h) => checked.has(h.id)).length;
        return (
          <Card key={slot.value} className="!p-0">
            <h2 className="flex items-center justify-between px-4 pb-1 pt-3 text-sm font-bold text-purple-900/70 dark:text-purple-200/70">
              <span>
                <span aria-hidden className="mr-1">
                  {SLOT_EMOJI[slot.value]}
                </span>
                {slot.label}
              </span>
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs tabular-nums text-purple-600 dark:bg-purple-950 dark:text-purple-300">
                {done}/{list.length}
              </span>
            </h2>
            <ul className="divide-y divide-pink-50 dark:divide-purple-950">
              {list.map((h) => {
                const d = defById.get(h.id)!;
                const on = checked.has(h.id);
                const expanded = open === h.id;
                return (
                  <li key={h.id} className={on ? "bg-gradient-to-r from-pink-50/60 to-purple-50/60 dark:from-pink-950/20 dark:to-purple-950/20" : ""}>
                    <div className="flex items-center gap-2 pl-4 pr-2">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-zinc-400">{h.time_label}</span>
                      <PriorityBadge p={priorityOn(d, date)} />
                      <button
                        className={`min-h-12 flex-1 py-2 text-left text-[15px] leading-snug ${on ? "text-zinc-400 line-through decoration-pink-300 dark:decoration-purple-700" : ""}`}
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
                            on
                              ? "animate-[check_0.3s_ease-out] border-transparent bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md shadow-pink-200 dark:shadow-none"
                              : "border-pink-200 text-transparent dark:border-purple-800"
                          }`}
                        >
                          ✓
                        </span>
                      </button>
                    </div>
                    {expanded && (
                      <div className="mx-3 mb-3 space-y-2 rounded-2xl bg-purple-50/80 px-4 py-3 text-sm dark:bg-purple-950/40">
                        <Detail label="💡 If-Then" text={h.if_then} />
                        <Detail label="⏱ 20秒の準備" text={h.prep_20sec} />
                        {h.name.includes("アファメーション") && (
                          <Link href="/affirmation" className="inline-block font-bold text-purple-600 underline">
                            アファメーションを読む ›
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
        <TimeField emoji="🌙" label="就寝時刻" value={entry?.sleep_time ?? null} disabled={isFuture} onSave={(v) => saveEntry(date, { sleep_time: v })} />
      </Card>

      <Card>
        <AutoText label="🙏 感謝・できたこと3つ" multiline disabled={isFuture} value={entry?.gratitude ?? ""} onSave={(v) => saveEntry(date, { gratitude: v })} />
      </Card>

      <Card>
        <AutoText label="📝 メモ(TODOなど)" multiline rows={4} value={entry?.memo ?? ""} onSave={(v) => saveEntry(date, { memo: v })} />
      </Card>

      {celebrate && <Celebration streak={streak} />}
    </div>
  );
}

/** 達成率のリング */
function Ring({ rate }: { rate: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-pink-100 dark:stroke-purple-950" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, rate))}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span data-testid="rate" className="text-base font-bold tabular-nums">
          {percent(rate)}
        </span>
        <span className="mt-0.5 text-[9px] text-zinc-400">達成率</span>
      </div>
    </div>
  );
}

/** A全達成のお祝い */
function Celebration({ streak }: { streak: number }) {
  const bits = ["✨", "💖", "⭐", "💜", "🎉", "✨", "💗", "⭐"];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute text-2xl opacity-0"
          style={{ left: `${10 + i * 11}%`, bottom: "35%", animation: `float-up 1.8s ease-out ${i * 0.08}s forwards` }}
        >
          {b}
        </span>
      ))}
      <div className="animate-[pop_2.2s_ease-out_forwards] rounded-[2rem] bg-gradient-to-br from-pink-400 to-purple-500 px-10 py-7 text-center text-white shadow-2xl shadow-pink-300/60">
        <div className="text-6xl leading-none">◎</div>
        <div className="mt-2 text-xl font-bold">A全達成!</div>
        <div className="text-sm opacity-90">🔥 連続 {streak}日</div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-purple-900/50 dark:text-purple-200/50">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-bold text-purple-900/60 dark:text-purple-200/60">{label}</div>
      <div className="whitespace-pre-wrap">{text || <span className="text-zinc-400">未設定</span>}</div>
    </div>
  );
}

/** 時刻。ふだんは文字で表示し、「今」で日本時間の現在時刻を入れる。✏️で好きな時刻に直せる */
function TimeField({
  emoji,
  label,
  value,
  disabled,
  onSave,
}: {
  emoji: string;
  label: string;
  value: string | null;
  disabled?: boolean;
  onSave: (v: string | null) => Promise<boolean>;
}) {
  const shown = value ? value.slice(0, 5).replace(/^0/, "") : "";
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save(next: string) {
    setSaved(await onSave(next || null));
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <div className="flex-1">
        <div className="text-xs font-medium text-purple-900/60 dark:text-purple-200/60">
          {label}
          {saved && <span className="ml-2 text-zinc-400">保存済み ✓</span>}
        </div>
        {editing ? (
          <input
            type="time"
            autoFocus
            aria-label={label}
            defaultValue={value ? value.slice(0, 5) : ""}
            onBlur={(e) => {
              if (e.target.value !== (value ?? "").slice(0, 5)) save(e.target.value);
              setEditing(false);
            }}
            className={`${inputCls} mt-1 text-lg tabular-nums`}
          />
        ) : (
          <div data-testid={`time-${label}`} className={`text-2xl font-bold tabular-nums ${shown ? "" : "text-zinc-300 dark:text-zinc-600"}`}>
            {shown || "--:--"}
          </div>
        )}
      </div>
      {!disabled && !editing && (
        <>
          <PencilButton onClick={() => setEditing(true)} label={label} />
          <button type="button" className={primaryBtnCls} onClick={() => save(nowTimeInTokyo())}>
            今
          </button>
        </>
      )}
    </div>
  );
}
