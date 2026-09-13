import type { Metadata } from "next";
import { DashboardView } from "@/components/app/DashboardView";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your equity, copies and open positions at a glance.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
