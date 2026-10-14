"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData, usePillarTerm } from "@/lib/store";

type Item = { href: string; label: string; icon: React.ReactNode; mobile: boolean };

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const ITEMS: Item[] = [
  { href: "/", label: "ホーム", mobile: true, icon: svg(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-5h4v5h3.5a1 1 0 0 0 1-1V10" /></>) },
  { href: "/today", label: "今日", mobile: true, icon: svg(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4M8.5 14.5l2.5 2.5 4.5-5" /></>) },
  { href: "/history", label: "カレンダー", mobile: false, icon: svg(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>) },
  { href: "/goals", label: "目標", mobile: true, icon: svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>) },
  { href: "/pillars", label: "5つの柱", mobile: false, icon: svg(<><path d="M3 21h18M5 21V9M9.5 21V9M14.5 21V9M19 21V9M2 9l10-6 10 6Z" /></>) },
  { href: "/dashboard", label: "ダッシュボード", mobile: false, icon: svg(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>) },
  { href: "/review", label: "振り返り", mobile: true, icon: svg(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>) },
  { href: "/wins", label: "できたこと", mobile: false, icon: svg(<><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9Z" /></>) },
  { href: "/affirmation", label: "アファメーション", mobile: false, icon: svg(<><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></>) },
  { href: "/settings", label: "設定", mobile: true, icon: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>) },
];

function isActive(path: string, href: string, mobile = false) {
  if (href === "/") return path === "/";
  // スマホでは「目標」タブの中に柱(大切な軸)がある
  if (mobile && href === "/goals") return path.startsWith("/goals") || path.startsWith("/pillars");
  if (href === "/review") return path.startsWith("/review") || path.startsWith("/history") || (mobile && path.startsWith("/dashboard"));
  return path.startsWith(href);
}

/** 上部の最終目標・中間目標の1行 */
function GoalLine() {
  const { profile } = useData();
  const fin = profile?.final_goal.trim();
  const mid = profile?.mid_goal.trim();
  return (
    <Link
      href="/goals"
      className="mx-4 mt-3 block truncate rounded-full border border-pink-100 bg-white/70 px-4 py-2 text-xs text-purple-900/70 shadow-sm backdrop-blur dark:border-purple-950 dark:bg-zinc-900/60 dark:text-purple-200/70"
    >
      {fin || mid ? (
        <>
          <span className="mr-1" aria-hidden>🎯</span>
          <span className="font-bold text-purple-900 dark:text-purple-100">{fin || "最終目標 未設定"}</span>
          <span className="mx-1.5 text-pink-400">›</span>
          {mid || "中間目標 未設定"}
        </>
      ) : (
        "最終目標と中間目標を設定する ›"
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { title: pillarTitle } = usePillarTerm();
  const labelOf = (it: Item) => (it.href === "/pillars" ? pillarTitle : it.label);
  return (
    <div className="flex min-h-dvh w-full">
      {/* PC:左のサイドバー */}
      <nav className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-pink-100 bg-white/50 p-3 backdrop-blur md:flex dark:border-purple-950 dark:bg-zinc-950/40">
        <div className="mb-4 flex items-center gap-2 px-3 pt-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md shadow-pink-200 dark:shadow-none">✓</span>
          <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-sm font-bold text-transparent">日別目標トラッカー</span>
        </div>
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm transition ${
              isActive(path, it.href) && !(it.href === "/review" && path.startsWith("/history"))
                ? "bg-gradient-to-r from-pink-100 to-purple-100 font-bold text-purple-700 shadow-sm dark:from-pink-950 dark:to-purple-950 dark:text-purple-200"
                : "text-zinc-600 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {it.icon}
            {labelOf(it)}
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ホームには目標のカードがあるので出さない */}
        {path !== "/" && <GoalLine />}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </div>

      {/* スマホ:下部のタブバー */}
      <nav className="fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-3xl border border-pink-100 bg-white/90 shadow-lg shadow-pink-200/50 backdrop-blur md:hidden dark:border-purple-950 dark:bg-zinc-950/90 dark:shadow-none">
        {ITEMS.filter((it) => it.mobile).map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[10px] tracking-tighter ${
              isActive(path, it.href, true) ? "font-bold text-purple-600 dark:text-purple-300" : "text-zinc-400"
            }`}
          >
            {it.icon}
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
