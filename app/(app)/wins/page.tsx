import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { WinsView } from "./WinsView";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <WinsView />
    </Suspense>
  );
}
