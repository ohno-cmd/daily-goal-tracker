import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { AffirmationView } from "./AffirmationView";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AffirmationView />
    </Suspense>
  );
}
