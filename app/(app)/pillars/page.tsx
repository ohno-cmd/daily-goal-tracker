import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { PillarsView } from "./PillarsView";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PillarsView />
    </Suspense>
  );
}
