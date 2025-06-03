"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/date-range-picker"
import { Search, X, ChevronDown, ChevronUp, Network, Globe, Server, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { fetchSources, fetchTemplates, fetchFiles } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

interface LogSearchFiltersProps {
  onSearch: (filters: any) => void
  initialFilters: any
}

export default function LogSearchFilters({ onSearch, initialFilters }: LogSearchFiltersProps) {
  const [filters, setFilters] = useState(initialFilters)
  const [expanded, setExpanded] = useState(false)
  const [activeFilters, setActiveFilters] = useState([])
  const { toast } = useToast()

  // State for API-loaded filter options
  const [sources, setSources] = useState([])
  const [templates, setTemplates] = useState([])
  const [files, setFiles] = useState([])

  // Fetch filter options from API
  useEffect(() => {
    // Fetch sources
    fetchSources()
      .then((data) => setSources(data))
      .catch((err) => {
        console.error("Error fetching sources:", err)
        toast({
          title: "Error loading sources",
          description: "Failed to load source filters",
          variant: "destructive",
        })
      })

    // Fetch templates
    fetchTemplates()
      .then((data) => setTemplates(data))
      .catch((err) => {
        console.error("Error fetching templates:", err)
        toast({
          title: "Error loading templates",
          description: "Failed to load template filters",
          variant: "destructive",
        })
      })

    // Fetch files
    fetchFiles()
      .then((data) => setFiles(data))
      .catch((err) => {
        console.error("Error fetching files:", err)
        toast({
          title: "Error loading files",
          description: "Failed to load file filters",
          variant: "destructive",
        })
      })
  }, [toast])

  const logLevels = [
    { id: "INFO", name: "INFO", color: "bg-blue-500" },
    { id: "WARN", name: "WARN", color: "bg-yellow-500" },
    { id: "ERROR", name: "ERROR", color: "bg-red-500" },
    { id: "DEBUG", name: "DEBUG", color: "bg-green-500" },
  ]

  const logTypes = [
    { id: "application", name: "Application", icon: "🔧" },
    { id: "system", name: "System", icon: "⚙️" },
    { id: "security", name: "Security", icon: "🔒" },
    { id: "network", name: "Network", icon: "🌐" },
    { id: "database", name: "Database", icon: "🗄️" },
    { id: "authentication", name: "Authentication", icon: "🔐" },
    { id: "authorization", name: "Authorization", icon: "🛡️" },
    { id: "performance", name: "Performance", icon: "⚡" },
    { id: "error", name: "Error", icon: "❌" },
    { id: "audit", name: "Audit", icon: "📋" },
  ]

  const protocols = [
    { id: "HTTP", name: "HTTP" },
    { id: "HTTPS", name: "HTTPS" },
    { id: "TCP", name: "TCP" },
    { id: "UDP", name: "UDP" },
    { id: "FTP", name: "FTP" },
    { id: "SSH", name: "SSH" },
    { id: "SMTP", name: "SMTP" },
    { id: "DNS", name: "DNS" },
    { id: "DHCP", name: "DHCP" },
    { id: "SNMP", name: "SNMP" },
  ]

  const timeRanges = [
    { id: "15m", name: "Last 15 minutes" },
    { id: "1h", name: "Last hour" },
    { id: "6h", name: "Last 6 hours" },
    { id: "24h", name: "Last 24 hours" },
    { id: "7d", name: "Last 7 days" },
    { id: "30d", name: "Last 30 days" },
    { id: "custom", name: "Custom range" },
  ]

  const severityLevels = [
    { id: "critical", name: "Critical" },
    { id: "high", name: "High" },
    { id: "medium", name: "Medium" },
    { id: "low", name: "Low" },
    { id: "info", name: "Info" },
  ]

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))

    // Update active filters for display
    if (value && value !== "" && key !== "timeRange" && key !== "startTime" && key !== "endTime") {
      const existingIndex = activeFilters.findIndex((f) => f.key === key)

      if (existingIndex >= 0) {
        const newFilters = [...activeFilters]
        newFilters[existingIndex] = { key, value, label: getFilterLabel(key, value) }
        setActiveFilters(newFilters)
      } else {
        setActiveFilters([...activeFilters, { key, value, label: getFilterLabel(key, value) }])
      }
    } else if (key !== "timeRange" && key !== "startTime" && key !== "endTime") {
      setActiveFilters(activeFilters.filter((f) => f.key !== key))
    }
  }

  const handleLogLevelChange = (level, checked) => {
    const currentLevels = [...filters.logLevels]

    if (checked) {
      if (!currentLevels.includes(level)) {
        currentLevels.push(level)
      }
    } else {
      const index = currentLevels.indexOf(level)
      if (index >= 0) {
        currentLevels.splice(index, 1)
      }
    }

    handleFilterChange("logLevels", currentLevels)
  }

  const handleDateRangeChange = (range) => {
    if (range?.from) {
      handleFilterChange("startTime", range.from)
      handleFilterChange("timeRange", "custom")
    }

    if (range?.to) {
      handleFilterChange("endTime", range.to)
      handleFilterChange("timeRange", "custom")
    }
  }

  const handleSearch = () => {
    onSearch(filters)
  }

  const handleReset = () => {
    const resetFilters = {
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
      severity: "",
      component: "",
      userId: "",
      sessionId: "",
      statusCode: "",
      method: "",
      userAgent: "",
      startTime: null,
      endTime: null,
      sortBy: "timestamp",
      sortOrder: "desc",
    }

    setFilters(resetFilters)
    setActiveFilters([])
    onSearch(resetFilters)
  }

  const removeFilter = (key) => {
    if (key === "logLevels") {
      handleFilterChange(key, ["INFO", "WARN", "ERROR", "DEBUG"])
    } else {
      handleFilterChange(key, "")
    }
  }

  const getFilterLabel = (key, value) => {
    switch (key) {
      case "source":
        const source = sources.find((s) => s.id === value)
        return `Source: ${source ? source.name : value}`
      case "templateId":
        const template = templates.find((t) => t.template_id.toString() === value)
        return `Template: ${template ? template.template.substring(0, 20) + "..." : value}`
      case "fileId":
        const file = files.find((f) => f.file_id === value)
        return `File: ${file ? file.original_filename : value}`
      case "logLevels":
        return `Levels: ${value.join(", ")}`
      case "searchText":
        return `Text: ${value}`
      case "logType":
        const logType = logTypes.find((t) => t.id === value)
        return `Type: ${logType ? logType.name : value}`
      case "protocol":
        return `Protocol: ${value}`
      case "ipAddress":
        return `IP: ${value}`
      case "hasNetworkInfo":
        return `Network Info: ${value ? "Yes" : "No"}`
      case "severity":
        return `Severity: ${value}`
      case "component":
        return `Component: ${value}`
      case "userId":
        return `User: ${value}`
      case "sessionId":
        return `Session: ${value.substring(0, 8)}...`
      case "statusCode":
        return `Status: ${value}`
      case "method":
        return `Method: ${value}`
      default:
        return `${key}: ${value}`
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search log messages..."
                  className="pl-8"
                  value={filters.searchText}
                  onChange={(e) => handleFilterChange("searchText", e.target.value)}
                />
              </div>
            </div>

            <Select value={filters.timeRange} onValueChange={(value) => handleFilterChange("timeRange", value)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                {timeRanges.map((range) => (
                  <SelectItem key={range.id} value={range.id}>
                    {range.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSearch}>Search</Button>
          </div>

          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="px-2 py-1">
                  {filter.label}
                  <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => removeFilter(filter.key)} />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleReset}>
                Clear all
              </Button>
            </div>
          )}

          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-xs flex items-center"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 h-4 w-4" />
                  Hide advanced filters
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-4 w-4" />
                  Show advanced filters
                </>
              )}
            </Button>

            {filters.timeRange === "custom" && (
              <DatePickerWithRange
                date={{
                  from: filters.startTime,
                  to: filters.endTime,
                }}
                onChange={handleDateRangeChange}
              />
            )}
          </div>

          {expanded && (
            <div className="space-y-6">
              {/* Basic Filters */}
              <div className="grid gap-4 pt-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label className="flex items-center">
                    <Shield className="mr-1 h-4 w-4" />
                    Log Levels
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {logLevels.map((level) => (
                      <div key={level.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`level-${level.id}`}
                          checked={filters.logLevels.includes(level.id)}
                          onCheckedChange={(checked) => handleLogLevelChange(level.id, checked)}
                        />
                        <Label htmlFor={`level-${level.id}`} className="text-sm font-normal flex items-center">
                          <div className={`w-2 h-2 rounded-full ${level.color} mr-1`}></div>
                          {level.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center">
                    <Server className="mr-1 h-4 w-4" />
                    Source
                  </Label>
                  <Select
                    value={filters.source || "all"}
                    onValueChange={(value) => handleFilterChange("source", value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {sources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select
                    value={filters.templateId || "all"}
                    onValueChange={(value) => handleFilterChange("templateId", value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All templates</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.template_id} value={template.template_id.toString()}>
                          {template.template.length > 30
                            ? template.template.substring(0, 30) + "..."
                            : template.template}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>File</Label>
                  <Select
                    value={filters.fileId || "all"}
                    onValueChange={(value) => handleFilterChange("fileId", value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select file" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All files</SelectItem>
                      {files.map((file) => (
                        <SelectItem key={file.file_id} value={file.file_id}>
                          {file.original_filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Log Type</Label>
                  <Select
                    value={filters.logType || "all"}
                    onValueChange={(value) => handleFilterChange("logType", value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select log type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {logTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <span className="flex items-center">
                            <span className="mr-2">{type.icon}</span>
                            {type.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={filters.severity || "all"}
                    onValueChange={(value) => handleFilterChange("severity", value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      {severityLevels.map((severity) => (
                        <SelectItem key={severity.id} value={severity.id}>
                          {severity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange("sortBy", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                      <SelectItem value="level">Log Level</SelectItem>
                      <SelectItem value="source">Source</SelectItem>
                      <SelectItem value="file">File</SelectItem>
                      <SelectItem value="log_type">Log Type</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sort Order</Label>
                  <Select value={filters.sortOrder} onValueChange={(value) => handleFilterChange("sortOrder", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Network-specific filters */}
              <div className="border-t pt-4">
                <Label className="text-base font-medium flex items-center mb-4">
                  <Globe className="mr-2 h-4 w-4" />
                  Network Filters
                </Label>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Network className="mr-1 h-4 w-4" />
                      Network Info
                    </Label>
                    <Select
                      value={filters.hasNetworkInfo === null ? "all" : filters.hasNetworkInfo.toString()}
                      onValueChange={(value) =>
                        handleFilterChange("hasNetworkInfo", value === "all" ? null : value === "true")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Has network info" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All logs</SelectItem>
                        <SelectItem value="true">With network info</SelectItem>
                        <SelectItem value="false">Without network info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Protocol</Label>
                    <Select
                      value={filters.protocol || "all"}
                      onValueChange={(value) => handleFilterChange("protocol", value === "all" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select protocol" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All protocols</SelectItem>
                        {protocols.map((protocol) => (
                          <SelectItem key={protocol.id} value={protocol.id}>
                            {protocol.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>IP Address</Label>
                    <Input
                      type="text"
                      placeholder="Enter IP address..."
                      value={filters.ipAddress || ""}
                      onChange={(e) => handleFilterChange("ipAddress", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>HTTP Method</Label>
                    <Select
                      value={filters.method || "all"}
                      onValueChange={(value) => handleFilterChange("method", value === "all" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All methods</SelectItem>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="HEAD">HEAD</SelectItem>
                        <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status Code</Label>
                    <Input
                      type="text"
                      placeholder="e.g., 200, 404, 500"
                      value={filters.statusCode || ""}
                      onChange={(e) => handleFilterChange("statusCode", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>User Agent</Label>
                    <Input
                      type="text"
                      placeholder="Search user agent..."
                      value={filters.userAgent || ""}
                      onChange={(e) => handleFilterChange("userAgent", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Additional filters */}
              <div className="border-t pt-4">
                <Label className="text-base font-medium flex items-center mb-4">
                  <Server className="mr-2 h-4 w-4" />
                  Additional Filters
                </Label>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Component</Label>
                    <Input
                      type="text"
                      placeholder="Component name..."
                      value={filters.component || ""}
                      onChange={(e) => handleFilterChange("component", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input
                      type="text"
                      placeholder="User identifier..."
                      value={filters.userId || ""}
                      onChange={(e) => handleFilterChange("userId", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Session ID</Label>
                    <Input
                      type="text"
                      placeholder="Session identifier..."
                      value={filters.sessionId || ""}
                      onChange={(e) => handleFilterChange("sessionId", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
