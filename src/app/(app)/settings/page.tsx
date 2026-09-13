import type { Metadata } from "next";
import { SettingsView } from "@/components/app/SettingsView";

export const metadata: Metadata = {
  title: "Settings",
  description: "Profile, account type, leverage and security.",
};

export default function SettingsPage() {
  return <SettingsView />;
}
