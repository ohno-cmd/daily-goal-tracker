"use client";

import { useState } from "react";
import { AutoText, Card, Loading, MoveButtons, btnCls, primaryBtnCls } from "@/components/ui";
import { useRows } from "@/lib/rows";
import { useData, useScores } from "@/lib/store";
import type { TextItem } from "@/lib/types";

export function AffirmationView() {
  const { status, error } = useData();
  const list = useRows<TextItem>("affirmations");
  const [editing, setEditing] = useState(false);
  const [reading, setReading] = useState(false);
  if (status !== "ready" || list.status === "loading") return <Loading error={error} />;
  const lines = list.rows.filter((r) => r.text.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">アファメーション</h1>
        <div className="flex gap-2">
          <button className={btnCls} onClick={() => setEditing(!editing)}>
            {editing ? "編集を終える" : "編集"}
          </button>
          <button className={primaryBtnCls} disabled={!lines.length} onClick={() => setReading(true)}>
            読み上げモード
          </button>
        </div>
      </div>

      {editing ? (
        <Card className="space-y-3">
          {list.rows.map((r, i) => (
            <div key={r.id} className="flex items-start gap-2">
              <AutoText multiline rows={2} value={r.text} onSave={(v) => list.update(r.id, { text: v })} className="flex-1" />
              <div className="flex flex-col gap-1">
                <MoveButtons onUp={() => list.move(r.id, -1)} onDown={() => list.move(r.id, 1)} disabledUp={i === 0} disabledDown={i === list.rows.length - 1} />
                <button className={`${btnCls} text-red-600`} onClick={() => confirm("この文を削除しますか?") && list.remove(r.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
          <button className={`${btnCls} w-full border-dashed`} onClick={() => list.insert({ text: "" })}>
            + 文を追加
          </button>
        </Card>
      ) : lines.length ? (
        <ol className="space-y-3">
          {lines.map((r) => (
            <li key={r.id} className="rounded-2xl bg-emerald-50 px-5 py-4 text-xl font-semibold leading-relaxed whitespace-pre-wrap dark:bg-emerald-950/40">
              {r.text}
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-10 text-center text-sm text-zinc-500">まだ文がありません。「編集」から追加するか、設定でインポートしてください。</p>
      )}

      {reading && <Reader lines={lines.map((l) => l.text)} onClose={() => setReading(false)} />}
    </div>
  );
}

/** 1文ずつ全画面に出し、タップで次へ。最後に「深呼吸・感謝・アファメーション」の✓を付けるか尋ねる */
function Reader({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  const { habits, checks, toggleCheck } = useData();
  const { today, defs } = useScores();
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const habit = habits.find((h) => h.name.includes("アファメーション") && !h.archived_at && defs.find((d) => d.id === h.id));
  const already = habit ? (checks.get(today)?.has(habit.id) ?? false) : false;
  const finished = i >= lines.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white" role="dialog" aria-label="読み上げモード">
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] text-sm text-zinc-400">
        <span>{finished ? "おわり" : `${i + 1} / ${lines.length}`}</span>
        <button className="min-h-11 min-w-11 rounded-xl px-3" onClick={onClose}>
          閉じる
        </button>
      </div>
      {!finished ? (
        <button className="flex flex-1 items-center justify-center px-8 text-center text-3xl font-bold leading-relaxed whitespace-pre-wrap" onClick={() => setI(i + 1)}>
          {lines[i]}
        </button>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="text-2xl font-bold">深呼吸して、感謝を。</div>
          {habit && !already && !done && (
            <>
              <p className="text-zinc-300">「{habit.name}」に今日の✓を付けますか?</p>
              <div className="flex gap-3">
                <button className="min-h-12 rounded-xl border border-zinc-600 px-5" onClick={onClose}>
                  付けない
                </button>
                <button
                  className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold"
                  onClick={async () => {
                    await toggleCheck(today, habit.id, true);
                    setDone(true);
                  }}
                >
                  ✓を付ける
                </button>
              </div>
            </>
          )}
          {(done || already) && <p className="text-emerald-400">✓ 今日の「{habit?.name}」は付いています</p>}
          <button className="min-h-12 rounded-xl border border-zinc-600 px-5" onClick={() => setI(0)}>
            もう一度読む
          </button>
          {(done || already || !habit) && (
            <button className="min-h-12 rounded-xl bg-white px-5 font-semibold text-zinc-900" onClick={onClose}>
              閉じる
            </button>
          )}
        </div>
      )}
    </div>
  );
}
