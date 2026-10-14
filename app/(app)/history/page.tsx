import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { HistoryView } from "./HistoryView";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <HistoryView />
    </Suspense>
  );
}
