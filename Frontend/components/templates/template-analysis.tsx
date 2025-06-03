"use client"

import { useState, useEffect } from "react"
import MainLayout from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Search, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"

export default function TemplateAnalysis() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("count")
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Mock data - would come from API in real app
  const mockTemplates = [
    {
      template_id: 15,
      template: "Database connection failed: timeout after <NUM>s",
      count: 12567,
      first_seen: "2024-11-28T08:15:00Z",
      last_seen: "2024-12-02T10:30:00Z",
      trend: "increasing",
      anomaly: true,
    },
    {
      template_id: 23,
      template: "User <STR> logged in successfully",
      count: 9876,
      first_seen: "2024-11-25T10:00:00Z",
      last_seen: "2024-12-02T10:25:00Z",
      trend: "stable",
      anomaly: false,
    },
    {
      template_id: 7,
      template: "API request to <STR> completed in <NUM>ms",
      count: 8765,
      first_seen: "2024-11-20T14:30:00Z",
      last_seen: "2024-12-02T10:20:00Z",
      trend: "decreasing",
      anomaly: false,
    },
    {
      template_id: 42,
      template: "Cache refresh completed with <NUM> entries",
      count: 7654,
      first_seen: "2024-11-30T09:00:00Z",
      last_seen: "2024-12-02T10:15:00Z",
      trend: "stable",
      anomaly: false,
    },
    {
      template_id: 31,
      template: "File upload failed: <STR>",
      count: 6543,
      first_seen: "2024-11-22T16:45:00Z",
      last_seen: "2024-12-02T10:10:00Z",
      trend: "increasing",
      anomaly: true,
    },
  ]

  const mockTimelineData = [
    { date: "Nov 28", count: 234 },
    { date: "Nov 29", count: 456 },
    { date: "Nov 30", count: 678 },
    { date: "Dec 01", count: 890 },
    { date: "Dec 02", count: 1234 },
  ]

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setTemplates(mockTemplates)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredTemplates = templates.filter((template) =>
    template.template.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    switch (sortBy) {
      case "count":
        return b.count - a.count
      case "template_id":
        return a.template_id - b.template_id
      case "first_seen":
        return new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime()
      case "last_seen":
        return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
      default:
        return 0
    }
  })

  const getTrendIcon = (trend) => {
    switch (trend) {
      case "increasing":
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case "decreasing":
        return <TrendingDown className="h-4 w-4 text-green-500" />
      default:
        return <div className="h-4 w-4" />
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Template Analysis</h2>
          <p className="text-muted-foreground">Analyze log patterns and template behavior</p>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.filter((t) => new Date(t.last_seen) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
              </div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{templates.filter((t) => t.anomaly).length}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {templates.length > 0
                  ? Math.round(templates.reduce((sum, t) => sum + t.count, 0) / templates.length)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">Logs per template</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template List</CardTitle>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Sort by Count</SelectItem>
                  <SelectItem value="template_id">Sort by ID</SelectItem>
                  <SelectItem value="first_seen">Sort by First Seen</SelectItem>
                  <SelectItem value="last_seen">Sort by Last Seen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTemplates.map((template) => (
                  <TableRow key={template.template_id}>
                    <TableCell className="font-mono">#{template.template_id}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate" title={template.template}>
                        {template.template}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{template.count.toLocaleString()}</TableCell>
                    <TableCell>{getTrendIcon(template.trend)}</TableCell>
                    <TableCell>{formatDate(template.first_seen)}</TableCell>
                    <TableCell>{formatDate(template.last_seen)}</TableCell>
                    <TableCell>
                      {template.anomaly ? (
                        <Badge variant="destructive">Anomaly</Badge>
                      ) : (
                        <Badge variant="secondary">Normal</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(template)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>Template #{selectedTemplate.template_id} Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded">
                  <p className="font-mono text-sm">{selectedTemplate.template}</p>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockTimelineData}>
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
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
