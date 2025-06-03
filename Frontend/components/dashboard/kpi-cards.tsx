"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, FileCode, AlertTriangle, Database, Activity, TrendingUp, TrendingDown, Network } from "lucide-react"

interface KpiCardsProps {
  stats: any
  systemStatus: { status: string; message: string }
  selectedFile?: any
  isFileSpecific?: boolean
}

export default function KpiCards({ stats, systemStatus, selectedFile, isFileSpecific }: KpiCardsProps) {
  if (!stats) return null

  // Extract data from the stats object based on the API response
  const totalLogs = isFileSpecific ? stats.total_logs : stats.total_logs || 0
  const totalTemplates = stats.total_templates || 0
  const totalFiles = stats.total_files || 0
  const errorRate = stats.error_rate ? stats.error_rate.toFixed(2) : "0.00"

  // For file-specific view, calculate error rate from level distribution
  let fileErrorRate = "0.00"
  if (isFileSpecific && stats.level_distribution) {
    const errorLogs = stats.level_distribution.find((item) => item._id === "ERROR")?.count || 0
    fileErrorRate = totalLogs > 0 ? ((errorLogs / totalLogs) * 100).toFixed(2) : "0.00"
  }

  // Growth indicators - these might not be in the API response
  const logsGrowth = stats.logs_growth || 0
  const templatesGrowth = stats.templates_growth || 0
  const filesGrowth = stats.files_growth || 0
  const errorRateChange = stats.error_rate_change || 0

  // Network info stats for file-specific view
  const hasNetworkInfo = isFileSpecific && stats.network_info_stats
  const networkLogsCount = hasNetworkInfo ? stats.network_info_stats.total_with_network_info || 0 : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{isFileSpecific ? "File Logs" : "Total Logs"}</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalLogs.toLocaleString()}</div>
          {isFileSpecific && selectedFile && (
            <p className="text-xs text-muted-foreground mt-1">From {selectedFile.original_filename}</p>
          )}
          {!isFileSpecific && (
            <div className="flex items-center text-xs text-muted-foreground">
              {logsGrowth > 0 ? (
                <>
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                  <span className="text-green-500">{logsGrowth}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                  <span className="text-red-500">{Math.abs(logsGrowth)}%</span>
                </>
              )}
              <span className="ml-1">from last period</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{isFileSpecific ? "Log Types" : "Templates"}</CardTitle>
          <FileCode className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isFileSpecific ? stats.log_type_distribution?.length || 0 : totalTemplates.toLocaleString()}
          </div>
          {isFileSpecific ? (
            <p className="text-xs text-muted-foreground mt-1">Different log types</p>
          ) : (
            <div className="flex items-center text-xs text-muted-foreground">
              {templatesGrowth > 0 ? (
                <>
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                  <span className="text-green-500">{templatesGrowth}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                  <span className="text-red-500">{Math.abs(templatesGrowth)}%</span>
                </>
              )}
              <span className="ml-1">from last period</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              Number.parseFloat(isFileSpecific ? fileErrorRate : errorRate) > 5 ? "text-red-500" : "text-green-500"
            }`}
          >
            {isFileSpecific ? fileErrorRate : errorRate}%
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            {errorRateChange > 0 ? (
              <>
                <TrendingUp className="mr-1 h-3 w-3 text-red-500" />
                <span className="text-red-500">{errorRateChange}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="mr-1 h-3 w-3 text-green-500" />
                <span className="text-green-500">{Math.abs(errorRateChange)}%</span>
              </>
            )}
            <span className="ml-1">from last period</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{isFileSpecific ? "Network Logs" : "Files"}</CardTitle>
          {isFileSpecific ? (
            <Network className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Database className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isFileSpecific ? networkLogsCount.toLocaleString() : totalFiles.toLocaleString()}
          </div>
          {isFileSpecific ? (
            <p className="text-xs text-muted-foreground mt-1">Logs with network info</p>
          ) : (
            <div className="flex items-center text-xs text-muted-foreground">
              {filesGrowth > 0 ? (
                <>
                  <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
                  <span className="text-green-500">{filesGrowth}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
                  <span className="text-red-500">{Math.abs(filesGrowth)}%</span>
                </>
              )}
              <span className="ml-1">from last period</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <div
              className={`h-3 w-3 rounded-full ${
                systemStatus.status === "healthy" ? "bg-green-500" : "bg-red-500"
              } mr-2`}
            ></div>
            <div className="text-xl font-bold">{systemStatus.status === "healthy" ? "Healthy" : "Issues Detected"}</div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{systemStatus.message}</p>
        </CardContent>
      </Card>
    </div>
  )
}
