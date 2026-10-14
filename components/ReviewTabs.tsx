"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "./GoalsTabs";

/** 振り返りの中の切り替え(週次レビュー / カレンダー) */
export function ReviewTabs() {
  const path = usePathname();
  return (
    <Tabs
      path={path}
      tabs={[
        { href: "/review", label: "📝 週次レビュー" },
        { href: "/history", label: "📅 カレンダー" },
      ]}
    />
  );
}
