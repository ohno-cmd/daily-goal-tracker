"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store";

type Item = { href: string; label: string; icon: React.ReactNode; mobile: boolean };

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const ITEMS: Item[] = [
  { href: "/", label: "今日", mobile: true, icon: svg(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4M8.5 14.5l2.5 2.5 4.5-5" /></>) },
  { href: "/history", label: "カレンダー", mobile: false, icon: svg(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>) },
  { href: "/goals", label: "目標", mobile: true, icon: svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>) },
  { href: "/dashboard", label: "ダッシュボード", mobile: true, icon: svg(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>) },
  { href: "/review", label: "振り返り", mobile: true, icon: svg(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>) },
  { href: "/affirmation", label: "アファメーション", mobile: false, icon: svg(<><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" /></>) },
  { href: "/settings", label: "設定", mobile: true, icon: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>) },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/review") return path.startsWith("/review") || path.startsWith("/history");
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
      className="block truncate border-b border-zinc-200 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
    >
      {fin || mid ? (
        <>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fin || "最終目標 未設定"}</span>
          <span className="mx-1.5 text-zinc-400">›</span>
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
  return (
    <div className="flex min-h-dvh w-full">
      {/* PC:左のサイドバー */}
      <nav className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 p-3 md:flex dark:border-zinc-800">
        <div className="mb-4 px-3 pt-2 text-sm font-bold">日別目標トラッカー</div>
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${
              isActive(path, it.href) && !(it.href === "/review" && path.startsWith("/history"))
                ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {it.icon}
            {it.label}
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <GoalLine />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:pb-10">{children}</main>
      </div>

      {/* スマホ:下部のタブバー */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
        {ITEMS.filter((it) => it.mobile).map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] ${
              isActive(path, it.href) ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
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
