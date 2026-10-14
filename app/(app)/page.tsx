import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { TodayView } from "./TodayView";

export default function TodayPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TodayView />
    </Suspense>
  );
}
