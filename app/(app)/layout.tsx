import { AppShell } from "@/components/AppShell";
import { DataProvider } from "@/lib/store";
import { ToastProvider } from "@/lib/toast";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <DataProvider>
        <AppShell>{children}</AppShell>
      </DataProvider>
    </ToastProvider>
  );
}
