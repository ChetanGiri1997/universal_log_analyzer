import type { Metadata } from "next"
import TemplateAnalysis from "@/components/templates/template-analysis"

export const metadata: Metadata = {
  title: "Templates | Log Analyzer Pro",
  description: "Analyze log templates and patterns",
}

export default function TemplatesPage() {
  return <TemplateAnalysis />
}
