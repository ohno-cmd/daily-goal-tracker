import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { DashboardView } from "./DashboardView";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardView />
    </Suspense>
  );
}
