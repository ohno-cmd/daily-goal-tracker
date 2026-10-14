"use client";

import Link from "next/link";
import { Loading, PageTitle } from "@/components/ui";
import { formatMd, formatYm } from "@/lib/dates";
import { useData, useScores } from "@/lib/store";

/** 「感謝・できたこと3つ」の1行ずつを取り出す(先頭の「・」「-」「1.」は外す) */
export function splitWins(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[・\-*•]|\d+[.)、.]|[①-⑳])\s*/, "").trim())
    .filter(Boolean);
}

/** これまでに書いた「できたこと」を見返す。落ち込んだ日に、積み上げてきた証拠を見るための画面 */
export function WinsView() {
  const { status, error, entries } = useData();
  const { day } = useScores();
  if (status !== "ready") return <Loading error={error} />;

  const list = [...entries.values()]
    .filter((e) => e.gratitude.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({ date: e.date, items: splitWins(e.gratitude), allA: day(e.date).allA }));
  const total = list.reduce((s, d) => s + d.items.length, 0);

  // 月ごとにまとめる
  const months = new Map<string, typeof list>();
  for (const d of list) months.set(d.date.slice(0, 7), [...(months.get(d.date.slice(0, 7)) ?? []), d]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle emoji="🌟">できたこと</PageTitle>
      <section className="rounded-[2rem] bg-gradient-to-br from-amber-100 via-pink-100 to-purple-200 p-5 text-center dark:from-amber-950/40 dark:via-pink-950/40 dark:to-purple-950/60">
        <div className="text-xs font-bold text-purple-900/60 dark:text-purple-200/70">これまでに積み上げた「できたこと」</div>
        <div className="mt-1 text-5xl font-bold tabular-nums" data-testid="wins-total">
          {total}
          <span className="text-lg">個</span>
        </div>
        <p className="mt-2 text-sm text-purple-900/70 dark:text-purple-200/70">{list.length}日分。落ち込んだ日は、ここを見返そう 🌷</p>
      </section>

      {list.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-400">
          夜に「感謝・できたこと3つ」を書くと、ここにたまっていきます。
          <br />
          <Link href="/today" className="font-bold text-purple-600 underline">
            今日の画面へ
          </Link>
        </p>
      )}

      {[...months].map(([ym, ds]) => (
        <div key={ym} className="space-y-3">
          <h2 className="px-1 text-sm font-bold text-purple-900/60 dark:text-purple-200/60">{formatYm(ym + "-01")}</h2>
          {ds.map((d) => (
            <Link
              key={d.date}
              href={`/today?d=${d.date}`}
              className="block rounded-3xl border border-pink-100 bg-white/85 p-4 shadow-[0_6px_24px_-14px_rgba(219,39,119,0.35)] transition active:scale-[0.99] dark:border-purple-950 dark:bg-zinc-900/70"
            >
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-purple-900/60 dark:text-purple-200/60">
                <span>{formatMd(d.date)}</span>
                {d.allA && <span className="rounded-full bg-gradient-to-r from-pink-400 to-purple-500 px-2 py-0.5 text-white">◎</span>}
              </div>
              <ul className="space-y-1.5">
                {d.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-relaxed">
                    <span aria-hidden>✨</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
