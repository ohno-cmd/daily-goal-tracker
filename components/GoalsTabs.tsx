"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 目標の中の切り替え(目標の全体像 / 5つの柱) */
export function GoalsTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/goals", label: "🎯 目標の全体像" },
    { href: "/pillars", label: "🏛️ 5つの柱" },
  ];
  return <Tabs tabs={tabs} path={path} />;
}

export function Tabs({ tabs, path }: { tabs: { href: string; label: string }[]; path: string }) {
  return (
    <div className={`grid ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-1 rounded-2xl border border-pink-100 bg-white/60 p-1 text-sm backdrop-blur dark:border-purple-950 dark:bg-zinc-900/60`}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex min-h-10 items-center justify-center rounded-xl transition ${
            path.startsWith(t.href)
              ? "bg-gradient-to-r from-pink-400 to-purple-500 font-bold text-white shadow-sm"
              : "text-purple-900/60 dark:text-purple-200/60"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
