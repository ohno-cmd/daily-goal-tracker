"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "./GoalsTabs";

/** 振り返りの中の切り替え(週次レビュー / カレンダー / グラフ) */
export function ReviewTabs() {
  const path = usePathname();
  return (
    <Tabs
      path={path}
      tabs={[
        { href: "/review", label: "📝 週次" },
        { href: "/history", label: "📅 カレンダー" },
        { href: "/dashboard", label: "📊 グラフ" },
      ]}
    />
  );
}
