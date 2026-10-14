import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { HomeView } from "./HomeView";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeView />
    </Suspense>
  );
}
