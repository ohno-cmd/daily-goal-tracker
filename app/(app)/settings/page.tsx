import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { SettingsView } from "./SettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsView />
    </Suspense>
  );
}
