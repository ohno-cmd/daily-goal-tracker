"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Priority } from "@/lib/scoring";
import loadingImg from "@/public/loading.png";

export const inputCls =
  "w-full rounded-2xl border border-pink-200 bg-white px-3 py-2.5 text-base outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100 disabled:bg-zinc-100 disabled:text-zinc-400 dark:border-purple-900 dark:bg-zinc-900 dark:focus:ring-purple-950 dark:disabled:bg-zinc-800";

export const btnCls =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-2xl border border-pink-200 bg-white/70 px-3 text-sm font-medium transition active:scale-95 disabled:opacity-40 dark:border-purple-900 dark:bg-zinc-900/60";

export const primaryBtnCls =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-pink-400 to-purple-500 px-4 text-sm font-bold text-white shadow-md shadow-pink-200 transition active:scale-95 disabled:opacity-40 dark:shadow-none";

export function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section
      id={id}
      className={`scroll-mt-4 rounded-3xl border border-pink-100 bg-white/85 p-4 shadow-[0_6px_24px_-12px_rgba(219,39,119,0.35)] backdrop-blur dark:border-purple-950 dark:bg-zinc-900/70 dark:shadow-none ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-pink-400 to-purple-500" aria-hidden />
        {children}
      </h2>
      {right}
    </div>
  );
}

/** ページの見出し */
export function PageTitle({ children, emoji }: { children: React.ReactNode; emoji?: string }) {
  return (
    <h1 className="flex items-center gap-2 text-2xl font-bold">
      {emoji && <span aria-hidden>{emoji}</span>}
      <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">{children}</span>
    </h1>
  );
}

const BADGE: Record<Priority, string> = {
  A: "bg-pink-500 text-white",
  B: "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  C: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

export function PriorityBadge({ p }: { p: Priority }) {
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${BADGE[p]}`}>
      {p}
    </span>
  );
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveMark({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className={`text-xs ${status === "error" ? "text-red-600" : "text-zinc-400"}`}>
      {status === "saving" ? "保存中…" : status === "saved" ? "保存済み ✓" : "保存できませんでした"}
    </span>
  );
}

export function PencilButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `${label}を編集` : "編集"}
      className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-purple-400 transition hover:bg-purple-50 active:scale-90 dark:hover:bg-purple-950"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

/**
 * ふだんは文字として表示し、✏️を押したときだけ入力欄になる。
 * 入力が止まって約1秒後と、入力欄から離れたときに保存する。
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
  viewClassName = "",
  type = "text",
  empty = "まだ書いていません",
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
  /** 表示しているときだけ足すクラス */
  viewClassName?: string;
  type?: "text" | "number";
  /** 空のときに出す文言 */
  empty?: string;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
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

  function done() {
    flush();
    setEditing(false);
  }

  const cls = `${inputCls} ${inputClassName}`;
  const canEdit = !disabled;
  return (
    <div className={`block ${className}`}>
      {label && (
        <div className="mb-1 flex min-h-6 items-center justify-between gap-2 text-sm font-medium text-purple-900/70 dark:text-purple-200/70">
          <span>{label}</span>
          <span className="flex items-center gap-1">
            <SaveMark status={status} />
            {canEdit && !editing && <PencilButton onClick={() => setEditing(true)} label={label} />}
          </span>
        </div>
      )}
      {editing ? (
        <div className="space-y-1">
          {multiline ? (
            <textarea
              autoFocus
              aria-label={label}
              value={text}
              rows={Math.max(rows, text.split("\n").length + 1)}
              placeholder={placeholder}
              onChange={(e) => change(e.target.value)}
              onBlur={done}
              onKeyDown={(e) => e.key === "Escape" && done()}
              className={`${cls} resize-y leading-relaxed`}
            />
          ) : (
            <input
              autoFocus
              aria-label={label}
              type={type}
              inputMode={type === "number" ? "numeric" : undefined}
              value={text}
              placeholder={placeholder}
              onChange={(e) => change(e.target.value)}
              onBlur={done}
              onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && done()}
              className={cls}
            />
          )}
          <div className="flex justify-end">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={done} className="rounded-full px-3 py-1 text-xs font-bold text-purple-600">
              完了
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <div
            onClick={() => canEdit && setEditing(true)}
            className={`min-h-6 flex-1 cursor-text whitespace-pre-wrap break-words leading-relaxed ${inputClassName} ${text ? viewClassName : "text-sm text-zinc-400"}`}
          >
            {text || (canEdit ? placeholder || empty : "—")}
          </div>
          {!label && canEdit && <PencilButton onClick={() => setEditing(true)} />}
        </div>
      )}
      {!label && status !== "idle" && (
        <span className="mt-0.5 block text-right">
          <SaveMark status={status} />
        </span>
      )}
    </div>
  );
}

export function Stat({ label, value, sub, emoji }: { label: string; value: React.ReactNode; sub?: React.ReactNode; emoji?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-pink-100 bg-white/85 p-3 shadow-[0_6px_24px_-14px_rgba(219,39,119,0.35)] dark:border-purple-950 dark:bg-zinc-900/70">
      {emoji && (
        <span className="absolute -right-1 -top-1 text-3xl opacity-25" aria-hidden>
          {emoji}
        </span>
      )}
      <div className="text-xs font-medium text-purple-900/60 dark:text-purple-200/60">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Loading({ error }: { error?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-purple-900/60 dark:text-purple-200/70">
      <Image src={loadingImg} alt="" width={180} priority unoptimized className="animate-[wiggle_1.2s_ease-in-out_infinite]" />
      {error ? <span className="text-red-600">{error}</span> : <span className="animate-pulse font-bold">読み込み中…</span>}
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
