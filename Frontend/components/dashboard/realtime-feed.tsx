"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { fetchRecentLogs, convertFiltersToQueryRequest, fetchLogs } from "@/lib/api"

interface RealtimeFeedProps {
  selectedFileId?: string | null
}

export default function RealtimeFeed({ selectedFileId }: RealtimeFeedProps) {
  const [logs, setLogs] = useState([])
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef(null)

  useEffect(() => {
    // Start polling
    const interval = startPolling()

    // Cleanup interval on component unmount
    return () => clearInterval(interval)
  }, [selectedFileId])

  const startPolling = () => {
    // Fetch initial logs
    fetchRecentLogsWithFilter()

    // Set up polling interval
    const interval = setInterval(() => {
      fetchRecentLogsWithFilter()
    }, 5000)

    return interval
  }

  const fetchRecentLogsWithFilter = async () => {
    try {
      if (selectedFileId) {
        // Use the query endpoint with file filter
        const now = new Date()
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

        const queryRequest = convertFiltersToQueryRequest({
          fileId: selectedFileId,
          startTime: fiveMinutesAgo.toISOString(),
          endTime: now.toISOString(),
          limit: 10,
          offset: 0,
        })

        const response = await fetchLogs(queryRequest)
        const data = response.logs || []

        setLogs((prevLogs) => {
          // Merge new logs with existing ones, avoiding duplicates
          const newLogs = data.filter((newLog) => !prevLogs.some((log) => log.id === newLog.id))
          return [...newLogs, ...prevLogs].slice(0, 20)
        })
      } else {
        // Fetch all recent logs
        const data = await fetchRecentLogs()
        setLogs((prevLogs) => {
          // Merge new logs with existing ones, avoiding duplicates
          const newLogs = data.filter((newLog) => !prevLogs.some((log) => log.id === newLog.id))
          return [...newLogs, ...prevLogs].slice(0, 20)
        })
      }
    } catch (err) {
      console.error("Error fetching recent logs:", err)
    }
  }

  // Refresh logs when file selection changes
  useEffect(() => {
    setLogs([]) // Clear existing logs
    fetchRecentLogsWithFilter()
  }, [selectedFileId])

  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0
    }
  }, [logs, autoScroll])

  const getLevelColor = (level) => {
    switch (level) {
      case "ERROR":
        return "bg-red-500"
      case "WARN":
        return "bg-yellow-500"
      case "INFO":
        return "bg-blue-500"
      case "DEBUG":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>
          Live Log Feed
          {selectedFileId && <span className="ml-2 text-sm font-normal text-muted-foreground">(Filtered)</span>}
        </CardTitle>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Auto-scroll</span>
          <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">
            <span className="flex items-center">
              <span className="w-2 h-2 mr-2 bg-blue-500 rounded-full"></span>
              Polling (5s intervals)
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{logs.length} recent logs</div>
        </div>
        <ScrollArea className="h-[600px]" ref={scrollAreaRef}>
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="p-3 text-sm border rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", getLevelColor(log.level))}>
                      {log.level}
                    </Badge>
                    {log.log_type && (
                      <Badge variant="secondary" className="text-xs">
                        {log.log_type}
                      </Badge>
                    )}
                    {log.network_info && (
                      <Badge variant="outline" className="text-xs">
                        Network
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</span>
                </div>
                <div className="mt-2 font-medium">{log.message}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Source: {log.source} | File: {log.filename || "Unknown"}
                  {log.network_info && log.network_info.protocol && (
                    <span> | Protocol: {log.network_info.protocol}</span>
                  )}
                  {log.network_info && log.network_info.ip_address && <span> | IP: {log.network_info.ip_address}</span>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}