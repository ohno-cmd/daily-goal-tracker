"use client";

import { Card, Loading, SectionTitle } from "@/components/ui";
import { useData } from "@/lib/store";
import { ImportPanel } from "./ImportPanel";

export function SettingsView() {
  const { status, error } = useData();
  if (status !== "ready") return <Loading error={error} />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">設定</h1>
      <Card id="import">
        <SectionTitle>スプレッドシートからインポート</SectionTitle>
        <ImportPanel />
      </Card>
    </div>
  );
}
