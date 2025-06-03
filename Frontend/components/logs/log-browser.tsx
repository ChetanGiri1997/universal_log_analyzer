"use client"

import { useState, useEffect } from "react"
import MainLayout from "@/components/main-layout"
import LogSearchFilters from "@/components/logs/log-search-filters"
import LogResults from "@/components/logs/log-results"
import { Button } from "@/components/ui/button"
import { Download, Share2 } from "lucide-react"
import { fetchLogs, fetchFiles, convertFiltersToQueryRequest } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function LogBrowser() {
  const [filters, setFilters] = useState({
    timeRange: "24h",
    logLevels: ["INFO", "WARN", "ERROR", "DEBUG"],
    source: "",
    templateId: "",
    fileId: "",
    searchText: "",
    logType: "",
    hasNetworkInfo: null,
    protocol: "",
    ipAddress: "",
    startTime: null,
    endTime: null,
    sortBy: "timestamp",
    sortOrder: "desc",
    limit: 100,
    offset: 0,
  })

  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState("all")
  const { toast } = useToast()

  // Fetch available files for filtering
  useEffect(() => {
    fetchFiles()
      .then((data) => {
        setFiles(data)
      })
      .catch((err) => {
        console.error("Error fetching files:", err)
        toast({
          title: "Error loading files",
          description: "Failed to load file list",
          variant: "destructive",
        })
      })
  }, [toast])

  const handleSearch = async (newFilters) => {
    setLoading(true)

    // Combine filters with file selection
    const searchFilters = {
      ...newFilters,
      fileId: selectedFile !== "all" ? selectedFile : "",
    }

    setFilters(searchFilters)

    try {
      // Convert our filters to the API's query format
      const queryRequest = convertFiltersToQueryRequest(searchFilters)

      // Make the API call
      const response = await fetchLogs(queryRequest)

      setLogs(response.logs || [])
      setTotalCount(response.total_count || response.logs?.length || 0)
    } catch (error) {
      console.error("Error searching logs:", error)
      toast({
        title: "Error searching logs",
        description: error.message || "Please try again later",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (fileId) => {
    setSelectedFile(fileId)
    handleSearch({
      ...filters,
      fileId: fileId !== "all" ? fileId : "",
    })
  }

  const handleExport = (format) => {
    // Create query string from filters
    const queryParams = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value && typeof value !== "object") {
        queryParams.append(key, value)
      } else if (Array.isArray(value)) {
        queryParams.append(key, value.join(","))
      }
    })

    // Redirect to export endpoint
    window.location.href = `https://api.chetangiri.com.np/api/logs/export/${format}?${queryParams.toString()}`
  }

  const handleShare = () => {
    // Create shareable URL with filters
    const queryParams = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value && typeof value !== "object") {
        queryParams.append(key, value)
      } else if (Array.isArray(value)) {
        queryParams.append(key, value.join(","))
      }
    })

    const shareUrl = `${window.location.origin}/logs?${queryParams.toString()}`

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({
        title: "URL copied to clipboard",
        description: "Share this URL to show the same log view",
      })
    })
  }

  // Check for URL params on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlFilters = {}

    for (const [key, value] of urlParams.entries()) {
      if (key === "logLevels") {
        urlFilters[key] = value.split(",")
      } else {
        urlFilters[key] = value
      }
    }

    if (Object.keys(urlFilters).length > 0) {
      const newFilters = { ...filters, ...urlFilters }
      setFilters(newFilters)
      handleSearch(newFilters)
    } else {
      handleSearch(filters)
    }
  }, [])

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Log Browser</h2>
          <p className="text-muted-foreground">Search and analyze your application logs with enhanced filtering</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFile} onValueChange={handleFileChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by file" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              {files.map((file) => (
                <SelectItem key={file.file_id} value={file.file_id}>
                  {file.original_filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button> */}
        </div>
      </div>

      <div className="grid gap-6">
        <LogSearchFilters onSearch={handleSearch} initialFilters={filters} />
        <LogResults logs={logs} loading={loading} totalCount={totalCount} />
      </div>
    </MainLayout>
  )
}
