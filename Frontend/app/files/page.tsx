import type { Metadata } from "next"
import FileManager from "@/components/files/file-manager"

export const metadata: Metadata = {
  title: "Files | Log Analyzer Pro",
  description: "Manage and analyze log files",
}

export default function FilesPage() {
  return <FileManager />
}
