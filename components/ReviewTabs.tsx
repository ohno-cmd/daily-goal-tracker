"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 振り返りの中の切り替え(週次レビュー / カレンダー) */
export function ReviewTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/review", label: "週次レビュー" },
    { href: "/history", label: "カレンダー" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex min-h-10 items-center justify-center rounded-lg ${
            path.startsWith(t.href) ? "bg-white font-semibold shadow-sm dark:bg-zinc-800" : "text-zinc-500"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
