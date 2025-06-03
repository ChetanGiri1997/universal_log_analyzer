import type { Metadata } from "next"
import Dashboard from "@/components/dashboard/dashboard"

export const metadata: Metadata = {
  title: "Dashboard | Log Analyzer Pro",
  description: "Overview of your log analytics and metrics",
}

export default function Home() {
  return <Dashboard />
}
