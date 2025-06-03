import type { Metadata } from "next"
import LogBrowser from "@/components/logs/log-browser"

export const metadata: Metadata = {
  title: "Logs | Log Analyzer Pro",
  description: "Search and analyze your application logs",
}

export default function LogsPage() {
  return <LogBrowser />
}
