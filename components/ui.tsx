"use client";

import { useEffect, useRef, useState } from "react";
import type { Priority } from "@/lib/scoring";

export const inputCls =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:disabled:bg-zinc-800";

export const btnCls =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-zinc-300 px-3 text-sm font-medium active:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:active:bg-zinc-800";

export const primaryBtnCls =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-40";

export function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
      <h2 className="text-base font-bold">{children}</h2>
      {right}
    </div>
  );
}

const BADGE: Record<Priority, string> = {
  A: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  B: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  C: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

export function PriorityBadge({ p }: { p: Priority }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold ${BADGE[p]}`}>
      {p}
    </span>
  );
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveMark({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={`text-xs ${status === "error" ? "text-red-600" : "text-zinc-400"}`}>
      {status === "saving" ? "保存中…" : status === "saved" ? "保存済み" : "保存できませんでした"}
    </span>
  );
}

/**
 * 入力が止まって約1秒後に保存するテキスト欄。
 * 外から value が変わったとき(別の日に移ったなど)は、入力中でなければ追従する
 */
export function AutoText({
  value,
  onSave,
  label,
  multiline = false,
  rows = 3,
  disabled,
  placeholder,
  className = "",
  inputClassName = "",
  type = "text",
}: {
  value: string;
  onSave: (v: string) => Promise<boolean | void>;
  label?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  type?: "text" | "number";
}) {
  const [text, setText] = useState(value);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);
  const latest = useRef({ text, onSave });
  useEffect(() => {
    latest.current = { text, onSave };
  });

  useEffect(() => {
    // 外から値が変わったら合わせる(入力中は上書きしない)
    if (!dirty.current) setText(value);
  }, [value]);

  async function flush() {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    setStatus("saving");
    const ok = await latest.current.onSave(latest.current.text);
    setStatus(ok === false ? "error" : "saved");
  }

  // 画面を離れるときに未保存の入力を保存する
  useEffect(() => () => void flush(), []);

  function change(v: string) {
    setText(v);
    dirty.current = true;
    setStatus("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1000);
  }

  const cls = `${inputCls} ${inputClassName}`;
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1 flex items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {label}
          <SaveMark status={status} />
        </span>
      )}
      {multiline ? (
        <textarea
          value={text}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
          onBlur={flush}
          className={`${cls} resize-y leading-relaxed`}
        />
      ) : (
        <input
          type={type}
          inputMode={type === "number" ? "numeric" : undefined}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
          onBlur={flush}
          className={cls}
        />
      )}
      {!label && status !== "idle" && (
        <span className="mt-0.5 block text-right">
          <SaveMark status={status} />
        </span>
      )}
    </label>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Loading({ error }: { error?: string }) {
  return (
    <div className="py-16 text-center text-sm text-zinc-500">
      {error ? <span className="text-red-600">{error}</span> : "読み込み中…"}
    </div>
  );
}

/** 並べ替え用の上下ボタン */
export function MoveButtons({ onUp, onDown, disabledUp, disabledDown }: { onUp: () => void; onDown: () => void; disabledUp?: boolean; disabledDown?: boolean }) {
  return (
    <div className="flex gap-1">
      <button type="button" aria-label="上へ" onClick={onUp} disabled={disabledUp} className={btnCls}>
        ↑
      </button>
      <button type="button" aria-label="下へ" onClick={onDown} disabled={disabledDown} className={btnCls}>
        ↓
      </button>
    </div>
  );
}

/** 達成率の色(0%:赤系 → 60%:黄 → 100%:緑) */
export function rateColor(rate: number): string {
  const r = Math.max(0, Math.min(1, rate));
  const hue = r <= 0.6 ? (r / 0.6) * 50 : 50 + ((r - 0.6) / 0.4) * 90;
  return `hsl(${Math.round(hue)} 75% 50%)`;
}

export function yen(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toLocaleString("ja-JP")}円`;
}
