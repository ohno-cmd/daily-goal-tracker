"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AutoText, Card, Loading, MoveButtons, SectionTitle, btnCls } from "@/components/ui";
import { WEEKDAYS, weekday } from "@/lib/dates";
import { toCsv } from "@/lib/import/csv";
import { useRows } from "@/lib/rows";
import { percent, priorityOn } from "@/lib/scoring";
import { useData, useScores } from "@/lib/store";
import { TIME_SLOTS, type Pillar, type Reward, type TextItem } from "@/lib/types";
import { HabitsEditor } from "./HabitsEditor";
import { ImportPanel } from "./ImportPanel";

export function SettingsView() {
  const { status, error, email } = useData();
  const pillars = useRows<Pillar>("pillars");
  const params = useSearchParams();

  // データが出そろってから #habits などへ移動する
  useEffect(() => {
    if (status === "ready" && location.hash) document.querySelector(location.hash)?.scrollIntoView();
  }, [status]);

  if (status !== "ready") return <Loading error={error} />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">設定</h1>
      <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-emerald-700 dark:text-emerald-400">
        {[
          ["#habits", "習慣"],
          ["#rewards", "ご褒美ルール"],
          ["#mood", "気分転換リスト"],
          ["#howto", "使い方"],
          ["#import", "インポート"],
          ["#export", "エクスポート"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="underline">
            {label}
          </a>
        ))}
      </nav>
      <Card id="habits">
        <SectionTitle>習慣</SectionTitle>
        <HabitsEditor pillars={pillars.rows} openId={params.get("habit")} />
      </Card>
      <Card id="rewards">
        <SectionTitle>ご褒美ルール</SectionTitle>
        <RewardRules />
      </Card>
      <Card id="mood">
        <SectionTitle>気分転換リスト</SectionTitle>
        <TextList table="mood_boosters" placeholder="散歩する、サウナ など" />
        <p className="mt-2 text-xs text-zinc-500">「今日」画面の達成率が3日続けて60%未満のとき、ここへのリンクを表示します。</p>
      </Card>
      <Card id="howto">
        <SectionTitle>使い方</SectionTitle>
        <HowTo />
      </Card>
      <Card id="import">
        <SectionTitle>スプレッドシートからインポート</SectionTitle>
        <ImportPanel />
      </Card>
      <Card id="export">
        <SectionTitle>CSVエクスポート</SectionTitle>
        <Export />
      </Card>
      <Card>
        <SectionTitle>アカウント</SectionTitle>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-zinc-500">{email}</span>
          <form action="/auth/signout" method="post">
            <button className={btnCls}>ログアウト</button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function RewardRules() {
  const { profile, saveProfile } = useData();
  const rewards = useRows<Reward & { sort_order?: number }>("rewards", "step");
  const rate = Number(profile?.reward_rate ?? 0.8);
  const nextStep = Math.max(0, ...rewards.rows.map((r) => r.step)) + 1;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <AutoText
          label="週の目標達成率(%)"
          value={String(Math.round(rate * 100))}
          onSave={(v) => {
            const n = Number(v.replace(/[^\d.]/g, ""));
            return n > 0 && n <= 100 ? saveProfile({ reward_rate: n / 100 }) : Promise.resolve(false);
          }}
        />
        <AutoText
          label="必要なA全達成日数"
          value={String(profile?.reward_a_days ?? 6)}
          onSave={(v) => {
            const n = Number(v.replace(/[^\d]/g, ""));
            return n >= 0 && n <= 7 && v.trim() !== "" ? saveProfile({ reward_a_days: n }) : Promise.resolve(false);
          }}
        />
      </div>
      <p className="text-xs text-zinc-500">
        週の点数が「1日の満点 × 7 × {percent(rate)}」以上、かつ A全達成が{profile?.reward_a_days ?? 6}日以上でクリア。クリアした回数に合わせて下のご褒美を順に出し、最後まで行ったら1週目に戻ります。
      </p>
      <ol className="space-y-2">
        {rewards.rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-sm text-zinc-500">{r.step}週目</span>
            <AutoText value={r.text} onSave={(v) => rewards.update(r.id, { text: v })} className="flex-1" />
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button className={btnCls} onClick={() => rewards.insert({ step: nextStep, text: "" })}>
          + {nextStep}週目を追加
        </button>
        {rewards.rows.length > 0 && (
          <button
            className={`${btnCls} text-red-600`}
            onClick={() => {
              const last = rewards.rows.reduce((a, b) => (a.step > b.step ? a : b));
              if (confirm(`${last.step}週目を削除しますか?`)) rewards.remove(last.id);
            }}
          >
            最後の段を削除
          </button>
        )}
      </div>
    </div>
  );
}

function TextList({ table, placeholder }: { table: string; placeholder: string }) {
  const list = useRows<TextItem>(table);
  return (
    <div className="space-y-2">
      {list.rows.map((r, i) => (
        <div key={r.id} className="flex items-center gap-2">
          <AutoText value={r.text} onSave={(v) => list.update(r.id, { text: v })} className="flex-1" placeholder={placeholder} />
          <MoveButtons onUp={() => list.move(r.id, -1)} onDown={() => list.move(r.id, 1)} disabledUp={i === 0} disabledDown={i === list.rows.length - 1} />
          <button className={`${btnCls} text-red-600`} aria-label="削除" onClick={() => list.remove(r.id)}>
            ×
          </button>
        </div>
      ))}
      <button className={`${btnCls} w-full border-dashed`} onClick={() => list.insert({ text: "" })}>
        + 追加
      </button>
    </div>
  );
}

function HowTo() {
  const items: [string, string[]][] = [
    ["毎朝(6:30ごろ)", ["起きたら「今」ボタンで起床時刻を入れる", "朝の習慣に✓を付ける", "今日の宣言を書く", "アファメーションを読み上げモードで読む"]],
    ["毎晩(22:15ごろ)", ["日中・夜の習慣に✓を付ける", "感謝・できたこと3つと、明日のTODOをメモに書く", "就寝前に就寝時刻を入れる(0時を過ぎても今日の欄でOK)"]],
    ["毎週(日曜の夜)", ["振り返り → 週次レビューで、一番崩れた習慣と原因を書く", "If-Thenを直し、「If-Thenを習慣に反映」を押す", "来週の大きな石を決める。ご褒美が出ていたら受け取る"]],
    ["毎月(月末)", ["目標 → 月次売上に実績を入れ、うまくいったこと・課題・来月の打ち手を書く", "ダッシュボードで習慣別・柱別の達成率を見る"]],
    ["3ヶ月ごと", ["目標の全体像で3ヶ月目標と5つの柱(WOOP)を見直す", "設定で習慣の優先度や内容を入れ替える(過去の点数は変わりません)"]],
  ];
  return (
    <div className="space-y-3 text-sm">
      {items.map(([title, steps]) => (
        <div key={title}>
          <div className="font-semibold">{title}</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-600 dark:text-zinc-400">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-zinc-500">点数:A=3点、B=2点、C=1点。◎=優先度Aが全部✓。連続日数は今日がまだ◎でなければ昨日までで数えます。</p>
    </div>
  );
}

function Export() {
  const { habits, entries, checks } = useData();
  const { defs, days, today } = useScores();

  function download(name: string, rows: (string | number | null | undefined)[][]) {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function daily() {
    const header = ["日付", "曜日", "起床時刻", "就寝時刻", "点数", "満点", "達成率", "A全達成", ...habits.map((h) => h.name), "今日の宣言", "感謝・できたこと3つ", "メモ"];
    const rows = days.map((r) => {
      const e = entries.get(r.date);
      const c = checks.get(r.date);
      return [
        r.date,
        WEEKDAYS[weekday(r.date)],
        e?.wake_time?.slice(0, 5),
        e?.sleep_time?.slice(0, 5),
        r.score,
        r.max,
        percent(r.rate),
        r.allA ? "◎" : "",
        ...habits.map((h) => (c?.has(h.id) ? "✓" : "")),
        e?.declaration,
        e?.gratitude,
        e?.memo,
      ];
    });
    // 今日より先に書いた宣言・メモも残す
    const future = [...entries.values()].filter((e) => e.date > today).map((e) => [e.date, WEEKDAYS[weekday(e.date)], "", "", "", "", "", "", ...habits.map(() => ""), e.declaration, e.gratitude, e.memo]);
    download(`日次記録_${today}.csv`, [header, ...rows, ...future]);
  }

  function habitList() {
    const slot = new Map(TIME_SLOTS.map((s) => [s.value, s.label]));
    const defById = new Map(defs.map((d) => [d.id, d]));
    download(`習慣リスト_${today}.csv`, [
      ["No", "時間帯", "時刻", "習慣", "優先度", "紐づく柱", "If-Then", "20秒の準備", "状態"],
      ...habits.map((h, i) => [i + 1, slot.get(h.time_slot), h.time_label, h.name, priorityOn(defById.get(h.id)!, today), h.pillar_label, h.if_then, h.prep_20sec, h.archived_at ? "アーカイブ" : ""]),
    ]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className={btnCls} onClick={daily}>
        日次記録(CSV)
      </button>
      <button className={btnCls} onClick={habitList}>
        習慣リスト(CSV)
      </button>
    </div>
  );
}
