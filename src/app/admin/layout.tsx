import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
