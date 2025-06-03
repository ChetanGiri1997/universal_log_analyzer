import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDown, ChevronRight, Eye, Copy, FileText, Network, Server, Clock, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogResultsProps {
  logs: any[]
  loading: boolean
  totalCount: number
}

export default function LogResults({ logs, loading, totalCount }: LogResultsProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [selectedLog, setSelectedLog] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const openLogDetail = (log) => {
    setSelectedLog(log)
  }

  const closeLogDetail = () => {
    setSelectedLog(null)
  }

  const getLevelColor = (level) => {
    switch (level) {
      case "ERROR":
        return "bg-red-500 hover:bg-red-600"
      case "WARN":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "INFO":
        return "bg-blue-500 hover:bg-blue-600"
      case "DEBUG":
        return "bg-green-500 hover:bg-green-600"
      default:
        return "bg-gray-500 hover:bg-gray-600"
    }
  }

  const getLogTypeColor = (logType) => {
    switch (logType?.toLowerCase()) {
      case "application":
        return "bg-purple-500"
      case "system":
        return "bg-orange-500"
      case "security":
        return "bg-red-600"
      case "network":
        return "bg-cyan-500"
      case "database":
        return "bg-green-600"
      case "authentication":
        return "bg-indigo-500"
      default:
        return "bg-gray-600"
    }
  }

  const getProtocolColor = (protocol) => {
    switch (protocol?.toUpperCase()) {
      case "HTTP":
        return "bg-blue-600"
      case "HTTPS":
        return "bg-green-600"
      case "TCP":
        return "bg-purple-600"
      case "UDP":
        return "bg-orange-600"
      case "SSH":
        return "bg-red-600"
      case "FTP":
        return "bg-yellow-600"
      default:
        return "bg-gray-600"
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString(),
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  const truncateText = (text, maxLength = 50) => {
    if (!text) return "N/A"
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="w-full h-16" />
              ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Search Results ({totalCount.toLocaleString()} logs found)</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No logs found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice((page - 1) * pageSize, page * pageSize).map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => toggleRow(log.id)} className="w-6 h-6 p-0">
                            {expandedRows[log.id] ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp).date}</span>
                            <span>{formatTimestamp(log.timestamp).time}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-white", getLevelColor(log.level))}>{log.level}</Badge>
                        </TableCell>
                        <TableCell>
                          {log.log_type ? (
                            <Badge variant="outline" className={cn("text-white", getLogTypeColor(log.log_type))}>
                              {log.log_type}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={log.message}>
                            {truncateText(log.message, 60)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Server className="w-3 h-3 mr-1 text-muted-foreground" />
                            <span className="text-sm">{truncateText(log.source, 20)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.network_info ? (
                            <div className="flex flex-col gap-1">
                              {log.network_info.protocol && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs text-white", getProtocolColor(log.network_info.protocol))}
                                >
                                  {log.network_info.protocol}
                                </Badge>
                              )}
                              {log.network_info.ip_address && (
                                <span className="font-mono text-xs text-muted-foreground">
                                  {log.network_info.ip_address}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="flex items-center">
                          <FileText className="w-3 h-3 mr-1 text-muted-foreground" />
                          <span className="text-sm">{truncateText(log.filename || "Unknown", 15)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openLogDetail(log)}
                              className="w-6 h-6 p-0"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(log.message)}
                              className="w-6 h-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRows[log.id] && (
                        <TableRow key={`${log.id}-expanded`}>
                          <TableCell colSpan={9} className="bg-muted/30">
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                                <div>
                                  <strong className="flex items-center">
                                    <Hash className="w-3 h-3 mr-1" />
                                    Log ID:
                                  </strong>
                                  <span className="font-mono">{log.id}</span>
                                </div>
                                <div>
                                  <strong className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Full Timestamp:
                                  </strong>
                                  <span className="font-mono">{formatTimestamp(log.timestamp).full}</span>
                                </div>
                                <div>
                                  <strong>Template ID:</strong>
                                  <span className="font-mono">#{log.template_id || "N/A"}</span>
                                </div>
                                <div>
                                  <strong>File ID:</strong>
                                  <span className="font-mono text-xs">{log.file_id || "N/A"}</span>
                                </div>
                              </div>

                              {log.network_info && (
                                <div className="pt-3 border-t">
                                  <strong className="flex items-center mb-2">
                                    <Network className="w-4 h-4 mr-1" />
                                    Network Information:
                                  </strong>
                                  <div className="grid grid-cols-2 gap-4 p-3 text-sm rounded md:grid-cols-4 bg-background">
                                    {log.network_info.protocol && (
                                      <div>
                                        <strong>Protocol:</strong>
                                        <Badge
                                          variant="outline"
                                          className={cn("ml-2 text-white", getProtocolColor(log.network_info.protocol))}
                                        >
                                          {log.network_info.protocol}
                                        </Badge>
                                      </div>
                                    )}
                                    {log.network_info.ip_address && (
                                      <div>
                                        <strong>IP Address:</strong>
                                        <span className="ml-2 font-mono">{log.network_info.ip_address}</span>
                                      </div>
                                    )}
                                    {log.network_info.port && (
                                      <div>
                                        <strong>Port:</strong>
                                        <span className="ml-2 font-mono">{log.network_info.port}</span>
                                      </div>
                                    )}
                                    {log.network_info.method && (
                                      <div>
                                        <strong>Method:</strong>
                                        <Badge variant="secondary" className="ml-2">
                                          {log.network_info.method}
                                        </Badge>
                                      </div>
                                    )}
                                    {log.network_info.status_code && (
                                      <div>
                                        <strong>Status:</strong>
                                        <Badge
                                          variant={
                                            log.network_info.status_code >= 400
                                              ? "destructive"
                                              : log.network_info.status_code >= 300
                                                ? "secondary"
                                                : "default"
                                          }
                                          className="ml-2"
                                        >
                                          {log.network_info.status_code}
                                        </Badge>
                                      </div>
                                    )}
                                    {log.network_info.user_agent && (
                                      <div className="col-span-2">
                                        <strong>User Agent:</strong>
                                        <span className="ml-2 text-xs">
                                          {truncateText(log.network_info.user_agent, 50)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {(log.context || log.tags || log.severity || log.component) && (
                                <div className="pt-3 border-t">
                                  <strong>Additional Information:</strong>
                                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm md:grid-cols-4">
                                    {log.context && (
                                      <div>
                                        <strong>Context:</strong>
                                        <span className="ml-2">{log.context}</span>
                                      </div>
                                    )}
                                    {log.component && (
                                      <div>
                                        <strong>Component:</strong>
                                        <span className="ml-2">{log.component}</span>
                                      </div>
                                    )}
                                    {log.severity && (
                                      <div>
                                        <strong>Severity:</strong>
                                        <Badge variant="outline" className="ml-2">
                                          {log.severity}
                                        </Badge>
                                      </div>
                                    )}
                                    {log.tags && (
                                      <div>
                                        <strong>Tags:</strong>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {(Array.isArray(log.tags) ? log.tags : [log.tags]).map((tag, index) => (
                                            <Badge key={index} variant="secondary" className="text-xs">
                                              {tag}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {log.metadata && (
                                <div className="pt-3 border-t">
                                  <strong>Metadata:</strong>
                                  <pre className="p-2 mt-1 overflow-x-auto text-xs border rounded bg-background max-h-32">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.template && (
                                <div className="pt-3 border-t">
                                  <strong>Template:</strong>
                                  <div className="p-3 mt-1 border rounded bg-background">
                                    <p className="font-mono text-sm">{log.template}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, logs.length)} of {totalCount}{" "}
                  results
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page * pageSize >= Math.min(logs.length, 1000)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={closeLogDetail}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Log Details - {selectedLog?.level}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Timestamp</label>
                    <p className="font-mono text-sm">{formatTimestamp(selectedLog.timestamp).full}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Level</label>
                    <div className="mt-1">
                      <Badge className={cn("text-white", getLevelColor(selectedLog.level))}>{selectedLog.level}</Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Log Type</label>
                    <div className="mt-1">
                      {selectedLog.log_type ? (
                        <Badge variant="outline" className={cn("text-white", getLogTypeColor(selectedLog.log_type))}>
                          {selectedLog.log_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Source</label>
                    <p className="text-sm">{selectedLog.source}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Template ID</label>
                    <p className="font-mono text-sm">#{selectedLog.template_id || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">File</label>
                    <p className="text-sm">{selectedLog.filename || "Unknown"}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Message</label>
                  <div className="p-3 mt-1 border rounded bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{selectedLog.message}</p>
                  </div>
                </div>

                {selectedLog.network_info && (
                  <div>
                    <label className="flex items-center text-sm font-medium">
                      <Network className="w-4 h-4 mr-1" />
                      Network Information
                    </label>
                    <div className="p-3 mt-1 border rounded bg-muted">
                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                        {Object.entries(selectedLog.network_info).map(([key, value]) => (
                          <div key={key}>
                            <strong className="capitalize">{key.replace(/_/g, " ")}:</strong>
                            <span className="ml-2 font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedLog.template && (
                  <div>
                    <label className="text-sm font-medium">Template</label>
                    <div className="p-3 mt-1 border rounded bg-muted">
                      <p className="font-mono text-sm">{selectedLog.template}</p>
                    </div>
                  </div>
                )}

                {selectedLog.metadata && (
                  <div>
                    <label className="text-sm font-medium">Metadata</label>
                    <div className="p-3 mt-1 border rounded bg-muted">
                      <pre className="overflow-x-auto text-xs">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {selectedLog.stack_trace && (
                  <div>
                    <label className="text-sm font-medium">Stack Trace</label>
                    <div className="p-3 mt-1 border rounded bg-muted">
                      <pre className="overflow-x-auto text-xs whitespace-pre-wrap">{selectedLog.stack_trace}</pre>
                    </div>
                  </div>
                )}

                {(selectedLog.context ||
                  selectedLog.component ||
                  selectedLog.severity ||
                  selectedLog.tags ||
                  selectedLog.user_id ||
                  selectedLog.session_id) && (
                  <div>
                    <label className="text-sm font-medium">Additional Information</label>
                    <div className="p-3 mt-1 border rounded bg-muted">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {selectedLog.context && (
                          <div>
                            <strong>Context:</strong>
                            <span className="ml-2">{selectedLog.context}</span>
                          </div>
                        )}
                        {selectedLog.component && (
                          <div>
                            <strong>Component:</strong>
                            <span className="ml-2">{selectedLog.component}</span>
                          </div>
                        )}
                        {selectedLog.severity && (
                          <div>
                            <strong>Severity:</strong>
                            <span className="ml-2">{selectedLog.severity}</span>
                          </div>
                        )}
                        {selectedLog.user_id && (
                          <div>
                            <strong>User ID:</strong>
                            <span className="ml-2 font-mono">{selectedLog.user_id}</span>
                          </div>
                        )}
                        {selectedLog.session_id && (
                          <div>
                            <strong>Session ID:</strong>
                            <span className="ml-2 font-mono">{selectedLog.session_id}</span>
                          </div>
                        )}
                        {selectedLog.tags && (
                          <div className="col-span-2">
                            <strong>Tags:</strong>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(Array.isArray(selectedLog.tags) ? selectedLog.tags : [selectedLog.tags]).map(
                                (tag, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}