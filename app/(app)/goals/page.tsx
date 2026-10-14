import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { GoalsView } from "./GoalsView";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <GoalsView />
    </Suspense>
  );
}
