"use client";

import { useState } from "react";
import { AutoText, PriorityBadge, btnCls, inputCls, primaryBtnCls } from "@/components/ui";
import { pillarMatches } from "@/lib/import/sheets";
import type { Priority } from "@/lib/scoring";
import { useData, usePillarTerm, type HabitPatch } from "@/lib/store";
import { TIME_SLOTS, type Habit, type Pillar, type TimeSlot } from "@/lib/types";

/** 習慣の編集:追加・並べ替え・アーカイブ(削除ではなく非表示。過去の✓は残る) */
export function HabitsEditor({ pillars, openId }: { pillars: Pillar[]; openId: string | null }) {
  const { habits, saveHabit, addHabit, reorderHabits } = useData();
  const { term } = usePillarTerm();
  const [open, setOpen] = useState<string | null>(openId);
  const [showArchived, setShowArchived] = useState(false);
  const active = habits.filter((h) => !h.archived_at);
  const archived = habits.filter((h) => h.archived_at);
  const labels = [...new Set([...pillars.map((p) => p.name), ...habits.map((h) => h.pillar_label)].filter(Boolean))];

  const pillarIdFor = (label: string) => pillars.find((p) => pillarMatches(p.name, label))?.id ?? null;
  const save = (h: Habit, patch: HabitPatch) => saveHabit(h.id, patch);

  function move(h: Habit, dir: -1 | 1) {
    const ids = active.map((x) => x.id);
    const i = ids.indexOf(h.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderHabits([...ids, ...archived.map((x) => x.id)]);
  }

  return (
    <div className="space-y-4">
      {TIME_SLOTS.map((slot) => (
        <div key={slot.value}>
          <h3 className="mb-1 text-sm font-semibold text-zinc-500">{slot.label}</h3>
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {active
              .filter((h) => h.time_slot === slot.value)
              .map((h) => (
                <li key={h.id}>
                  <button className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm" onClick={() => setOpen(open === h.id ? null : h.id)} aria-expanded={open === h.id}>
                    <span className="w-12 shrink-0 text-xs text-zinc-500">{h.time_label}</span>
                    <PriorityBadge p={h.priority} />
                    <span className="flex-1">{h.name}</span>
                    <span className="text-zinc-400">{open === h.id ? "▲" : "▼"}</span>
                  </button>
                  {open === h.id && (
                    <div className="space-y-2 bg-zinc-50 p-3 dark:bg-zinc-900" data-habit={h.id}>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block text-sm">
                          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">時間帯</span>
                          <select value={h.time_slot} onChange={(e) => save(h, { time_slot: e.target.value as TimeSlot })} className={inputCls}>
                            {TIME_SLOTS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <AutoText label="時刻" value={h.time_label} onSave={(v) => save(h, { time_label: v })} placeholder="6:00 / 〜14:00 / —" />
                        <label className="block text-sm">
                          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">優先度</span>
                          <select aria-label="優先度" value={h.priority} onChange={(e) => save(h, { priority: e.target.value as Priority })} className={inputCls}>
                            <option value="A">A(3点)</option>
                            <option value="B">B(2点)</option>
                            <option value="C">C(1点)</option>
                          </select>
                        </label>
                      </div>
                      <p className="text-xs text-zinc-500">優先度の変更は今日から反映します。前日までの点数・◎は変わりません。</p>
                      <AutoText label="習慣名" value={h.name} onSave={(v) => (v.trim() ? save(h, { name: v.trim() }) : Promise.resolve(false))} />
                      <label className="block text-sm">
                        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">紐づく{term}</span>
                        <PillarInput value={h.pillar_label} options={labels} onSave={(v) => save(h, { pillar_label: v, pillar_id: pillarIdFor(v) })} />
                      </label>
                      <AutoText label="If-Then" multiline rows={2} value={h.if_then} onSave={(v) => save(h, { if_then: v })} />
                      <AutoText label="20秒の準備" multiline rows={2} value={h.prep_20sec} onSave={(v) => save(h, { prep_20sec: v })} />
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="flex gap-1">
                          <button className={btnCls} onClick={() => move(h, -1)} aria-label="上へ">
                            ↑
                          </button>
                          <button className={btnCls} onClick={() => move(h, 1)} aria-label="下へ">
                            ↓
                          </button>
                        </div>
                        <button
                          className={btnCls}
                          onClick={() => confirm(`「${h.name}」をアーカイブしますか?今日から表示されなくなり、過去の✓は残ります。`) && save(h, { archived_at: new Date().toISOString() })}
                        >
                          アーカイブ
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}

      <NewHabit term={term} labels={labels} onAdd={(h) => addHabit({ ...h, pillar_id: pillarIdFor(h.pillar_label ?? "") })} />

      {archived.length > 0 && (
        <div>
          <button className="text-sm text-zinc-500 underline" onClick={() => setShowArchived(!showArchived)}>
            アーカイブした習慣({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm text-zinc-500">
                  <PriorityBadge p={h.priority} />
                  <span className="flex-1">{h.name}</span>
                  <button className={btnCls} onClick={() => save(h, { archived_at: null })}>
                    戻す
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PillarInput({ value, options, onSave }: { value: string; options: string[]; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <>
      <input list="pillar-options" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v.trim())} className={inputCls} />
      <datalist id="pillar-options">
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

function NewHabit({ term, labels, onAdd }: { term: string; labels: string[]; onAdd: (h: HabitPatch & Pick<Habit, "name" | "priority" | "time_slot">) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", time_slot: "morning" as TimeSlot, time_label: "", priority: "B" as Priority, pillar_label: "" });
  if (!open)
    return (
      <button className={`${btnCls} w-full border-dashed`} onClick={() => setOpen(true)}>
        + 習慣を追加
      </button>
    );
  return (
    <form
      className="space-y-2 rounded-xl border border-purple-200 p-3 dark:border-purple-900"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim()) return;
        await onAdd({ ...f, name: f.name.trim() });
        setF({ ...f, name: "", time_label: "" });
        setOpen(false);
      }}
    >
      <input required placeholder="習慣名" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <select value={f.time_slot} onChange={(e) => setF({ ...f, time_slot: e.target.value as TimeSlot })} className={inputCls} aria-label="時間帯">
          {TIME_SLOTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input placeholder="時刻" value={f.time_label} onChange={(e) => setF({ ...f, time_label: e.target.value })} className={inputCls} />
        <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })} className={inputCls} aria-label="優先度">
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
      </div>
      <input list="pillar-options" placeholder={`紐づく${term}`} value={f.pillar_label} onChange={(e) => setF({ ...f, pillar_label: e.target.value })} className={inputCls} />
      <datalist id="pillar-options">
        {labels.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={() => setOpen(false)}>
          やめる
        </button>
        <button className={primaryBtnCls}>追加する</button>
      </div>
    </form>
  );
}
