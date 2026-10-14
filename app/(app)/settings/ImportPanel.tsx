"use client";

import { useMemo, useState } from "react";
import { btnCls, inputCls, primaryBtnCls } from "@/components/ui";
import { applyPlan } from "@/lib/import/apply";
import { parseCsv, type Grid } from "@/lib/import/csv";
import { buildPlan, detectSheet, SHEETS, summarizePlan, type SheetKind } from "@/lib/import/sheets";
import { useData } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

type Picked = { name: string; kind: SheetKind | ""; grid: Grid };

/** スプレッドシートのCSVを取り込む。件数をプレビューして、確認してから保存する */
export function ImportPanel() {
  const { habits, reload } = useData();
  const [files, setFiles] = useState<Picked[]>([]);
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function pick(list: FileList | null) {
    if (!list) return;
    setDone(false);
    setError(undefined);
    const read = await Promise.all(
      [...list].map(async (f) => ({ name: f.name, kind: detectSheet(f.name) ?? ("" as const), grid: parseCsv(await f.text()) })),
    );
    setFiles((prev) => [...prev.filter((p) => !read.some((r) => r.name === p.name)), ...read]);
  }

  const plan = useMemo(() => {
    const ready = files.filter((f): f is Picked & { kind: SheetKind } => !!f.kind);
    return ready.length ? buildPlan(ready, habits.map((h) => h.name)) : null;
  }, [files, habits]);
  const summary = plan ? summarizePlan(plan) : [];
  const replaces = [
    plan?.goals?.benefactors.length && "恩返しリスト",
    plan?.affirmations?.length && "アファメーション",
    plan?.rewards?.steps.length && "ご褒美",
    plan?.rewards?.moodBoosters.length && "気分転換リスト",
  ].filter(Boolean);

  async function save() {
    if (!plan) return;
    setError(undefined);
    try {
      await applyPlan(createClient(), plan, setStep);
      await reload();
      setDone(true);
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStep(undefined);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <details className="rounded-xl bg-zinc-50 p-3 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <summary className="cursor-pointer font-medium">CSVの書き出し方</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Googleスプレッドシート「大野 日別目標」を開く</li>
          <li>取り込みたいシートを選び、「ファイル → ダウンロード → カンマ区切り形式(.csv)」</li>
          <li>シートごとに繰り返し、ここでまとめて選ぶ</li>
        </ol>
        <p className="mt-2">
          対応:{SHEETS.map((s) => s.label).join("、")}。同じ日付・同じ月・同じ週は上書きします。ダッシュボードはアプリが計算するので取り込み不要です(「シートを選ぶ」のままのファイルは使いません)。
        </p>
      </details>

      <label className={`${btnCls} w-full cursor-pointer border-dashed`}>
        CSVファイルを選ぶ(複数可)
        <input type="file" accept=".csv,text/csv" multiple className="sr-only" onChange={(e) => pick(e.target.files)} />
      </label>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={f.name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              <select
                aria-label={`${f.name} のシート`}
                value={f.kind}
                onChange={(e) => setFiles((fs) => fs.map((x, j) => (j === i ? { ...x, kind: e.target.value as SheetKind } : x)))}
                className={`${inputCls} w-40 !py-2 text-sm`}
              >
                <option value="">シートを選ぶ</option>
                {SHEETS.map((s) => (
                  <option key={s.kind} value={s.kind}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button className={btnCls} aria-label="外す" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {plan && (
        <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-900 dark:bg-purple-950/40">
          <div className="font-semibold">取り込む内容</div>
          <p data-testid="import-summary">{summary.length ? summary.join("、") : "取り込める内容がありません"}</p>
          {replaces.length > 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">今ある{replaces.join("・")}は置き換えます。</p>}
          {plan.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">
              {plan.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <button className={`${primaryBtnCls} w-full`} disabled={!summary.length || !!step} onClick={save}>
            {step ?? "この内容で保存する"}
          </button>
        </div>
      )}
      {done && <p className="text-purple-700 dark:text-purple-400">取り込みが終わりました。</p>}
      {error && <p className="text-red-600">取り込めませんでした:{error}</p>}
    </div>
  );
}
