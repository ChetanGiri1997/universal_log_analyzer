import type { Metadata } from "next"
import Analytics from "@/components/analytics/analytics"

export const metadata: Metadata = {
  title: "Analytics | Log Analyzer Pro",
  description: "Advanced analytics and insights for your logs",
}

export default function AnalyticsPage() {
  return <Analytics />
}
