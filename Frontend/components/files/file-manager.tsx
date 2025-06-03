"use client"

import { useState, useCallback, useEffect } from "react"
import MainLayout from "@/components/main-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useDropzone } from "react-dropzone"
import { Upload, File, Trash2, Download, BarChart3 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { fetchFiles, uploadFile, fetchFileStats } from "@/lib/api"

export default function FileManager() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [stats, setStats] = useState({
    total_size: 0,
    processed_logs: 0,
    failed_logs: 0,
  })
  const { toast } = useToast()

  // Fetch files from API
  const loadFiles = async () => {
    try {
      const data = await fetchFiles()
      setFiles(data)

      // Calculate stats
      const totalSize = data.reduce((sum, f) => sum + f.file_size, 0)
      const processedLogs = data.reduce((sum, f) => sum + f.processed_logs, 0)
      const failedLogs = data.reduce((sum, f) => sum + f.failed_logs, 0)

      setStats({
        total_size: totalSize,
        processed_logs: processedLogs,
        failed_logs: failedLogs,
      })
    } catch (error) {
      console.error("Error fetching files:", error)
      toast({
        title: "Error loading files",
        description: error.message || "Failed to load files",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    loadFiles()
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles) => {
      setUploading(true)
      setUploadProgress(0)

      for (const file of acceptedFiles) {
        try {
          const formData = new FormData()
          formData.append("file", file)

          // Simulate upload progress
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => {
              if (prev >= 90) {
                clearInterval(progressInterval)
                return prev
              }
              return prev + 10
            })
          }, 300)

          // Upload file using the API endpoint from the OpenAPI spec
          await uploadFile(formData)

          clearInterval(progressInterval)
          setUploadProgress(100)

          toast({
            title: "File uploaded successfully",
            description: `${file.name} has been processed`,
          })

          // Refresh file list
          await loadFiles()
        } catch (error) {
          console.error("Error uploading file:", error)
          toast({
            title: "Upload failed",
            description: `Failed to upload ${file.name}`,
            variant: "destructive",
          })
        }
      }

      setUploading(false)
      setUploadProgress(0)
    },
    [toast],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".log", ".txt"],
      "application/json": [".json"],
    },
    multiple: true,
  })

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>
      case "processing":
        return <Badge className="bg-yellow-500">Processing</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Note: The OpenAPI spec doesn't include a delete endpoint
  const handleDeleteFile = async (fileId) => {
    toast({
      title: "Operation not supported",
      description: "File deletion is not supported by the API",
      variant: "destructive",
    })
  }

  const downloadFile = (file) => {
    // In a real app, this would download the file
    // The OpenAPI spec doesn't include a download endpoint
    toast({
      title: "Operation not supported",
      description: "File download is not supported by the API",
    })
  }

  const viewAnalytics = async (file) => {
    try {
      const stats = await fetchFileStats(file.file_id)
      toast({
        title: "File Statistics Generated",
        description: `${file.original_filename}: ${stats.total_logs} logs analyzed`,
      })
      // In a real app, this would navigate to a file analytics page
      console.log("File stats:", stats)
    } catch (error) {
      console.error("Error fetching file stats:", error)
      toast({
        title: "Error",
        description: "Failed to generate file statistics",
        variant: "destructive",
      })
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">File Management</h2>
          <p className="text-muted-foreground">Upload and manage your log files</p>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <File className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{files.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatFileSize(stats.total_size)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Processed Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processed_logs.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Failed Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.failed_logs}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-lg">Drop the files here...</p>
              ) : (
                <div>
                  <p className="mb-2 text-lg">Drag & drop log files here, or click to select</p>
                  <p className="text-sm text-muted-foreground">Supports .log, .txt, and .json files</p>
                </div>
              )}
            </div>

            {uploading && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Uploading... Large Files ma take a bit longer to preocess......</span>
                  <span className="text-sm">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Files</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No files uploaded yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.file_id}>
                      <TableCell className="font-medium">{file.original_filename}</TableCell>
                      <TableCell>{formatFileSize(file.file_size)}</TableCell>
                      <TableCell>{formatDate(file.upload_timestamp)}</TableCell>
                      <TableCell>{file.processed_logs.toLocaleString()}</TableCell>
                      <TableCell className={file.failed_logs > 0 ? "text-red-500" : ""}>{file.failed_logs}</TableCell>
                      <TableCell>{getStatusBadge(file.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewAnalytics(file)}
                            title="Generate Analytics"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadFile(file)} title="Download">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFile(file.file_id)}
                            title="Delete"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
