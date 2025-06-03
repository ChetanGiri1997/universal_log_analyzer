"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface VisualAnalyticsProps {
  stats: any
  selectedFile?: any
  isFileSpecific?: boolean
}

export default function VisualAnalytics({ stats, selectedFile, isFileSpecific }: VisualAnalyticsProps) {
  const [timeRange, setTimeRange] = useState("24h")

  if (!stats) return null

  // Process data from API
  const hourlyActivity = stats.hourly_activity || []
  const levelDistribution =
    stats.level_distribution?.map((item) => ({
      name: item._id,
      value: item.count,
      color: getLevelColor(item._id),
    })) || []

  // For file-specific view, use log_type_distribution instead of top_sources
  const distributionData = isFileSpecific
    ? stats.log_type_distribution?.map((item) => ({
        name: item._id || item.type || "Unknown",
        logs: item.count,
      })) || []
    : stats.top_sources?.map((item) => ({
        name: item._id,
        logs: item.count,
      })) || []

  const errorTrends = stats.error_trends || []

  const templateFrequency =
    stats.top_templates?.map((item) => ({
      id: `Template #${item.template_id}`,
      count: item.count,
    })) || []

  // Network info distribution for file-specific view
  const networkDistribution =
    isFileSpecific && stats.network_info_stats
      ? [
          { name: "With Network Info", value: stats.network_info_stats.total_with_network_info || 0 },
          {
            name: "Without Network Info",
            value: (stats.total_logs || 0) - (stats.network_info_stats.total_with_network_info || 0),
          },
        ].filter((item) => item.value > 0)
      : []

  function getLevelColor(level) {
    switch (level) {
      case "INFO":
        return "#3b82f6"
      case "WARN":
        return "#f59e0b"
      case "ERROR":
        return "#ef4444"
      case "DEBUG":
        return "#10b981"
      default:
        return "#6b7280"
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>{isFileSpecific ? `Log Activity - ${selectedFile?.original_filename}` : "Log Activity"}</CardTitle>
          <Tabs defaultValue="24h" onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="6h">6h</TabsTrigger>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyActivity} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="_id" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(17, 17, 17, 0.8)",
                  border: "none",
                  borderRadius: "4px",
                  color: "#fff",
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Log Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={levelDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {levelDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: "rgba(17, 17, 17, 0.8)",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isFileSpecific ? "Log Type Distribution" : "Top Sources"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distributionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis type="number" stroke="#888" />
                <YAxis dataKey="name" type="category" stroke="#888" width={100} />
                <Tooltip
                  formatter={(value) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: "rgba(17, 17, 17, 0.8)",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="logs" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {isFileSpecific && networkDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Network Information Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={networkDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {networkDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#3b82f6" : "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => value.toLocaleString()}
                    contentStyle={{
                      backgroundColor: "rgba(17, 17, 17, 0.8)",
                      border: "none",
                      borderRadius: "4px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {!isFileSpecific && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Error Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={errorTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="date" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(17, 17, 17, 0.8)",
                        border: "none",
                        borderRadius: "4px",
                        color: "#fff",
                      }}
                    />
                    <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="rate" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={templateFrequency} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="id" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip
                      formatter={(value) => value.toLocaleString()}
                      contentStyle={{
                        backgroundColor: "rgba(17, 17, 17, 0.8)",
                        border: "none",
                        borderRadius: "4px",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
