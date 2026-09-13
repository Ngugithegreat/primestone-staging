import { AppShell } from "@/components/app/AppShell";
import { CopyEngine } from "@/components/app/CopyEngine";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <CopyEngine />
      {children}
    </AppShell>
  );
}
