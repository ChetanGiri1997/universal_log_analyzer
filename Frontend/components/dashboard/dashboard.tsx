"use client";

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import KpiCards from "@/components/dashboard/kpi-cards";
import VisualAnalytics from "@/components/dashboard/visual-analytics";
import RealtimeFeed from "@/components/dashboard/realtime-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchDashboardStats, checkHealth, fetchFiles, fetchFileStats } from "@/lib/api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [lastRefreshedString, setLastRefreshedString] = useState("");
  const [systemStatus, setSystemStatus] = useState({ status: "unknown", message: "Checking system status..." });
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("all");
  const [fileStats, setFileStats] = useState(null);
  const [loadingFileStats, setLoadingFileStats] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardStats();
      setStats(data);
      const newDate = new Date();
      setLastRefreshed(newDate);
      setLastRefreshedString(newDate.toLocaleTimeString());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error fetching dashboard data",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const filesData = await fetchFiles();
      setFiles(filesData);
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({
        title: "Error loading files",
        description: "Failed to load file list",
        variant: "destructive",
      });
    }
  };

  const loadFileStats = async (fileId) => {
    if (fileId === "all") {
      setFileStats(null);
      return;
    }
    try {
      setLoadingFileStats(true);
      const stats = await fetchFileStats(fileId);
      setFileStats(stats);
    } catch (error) {
      console.error("Error fetching file stats:", error);
      toast({
        title: "Error loading file statistics",
        description: "Failed to load file-specific statistics",
        variant: "destructive",
      });
      setFileStats(null);
    } finally {
      setLoadingFileStats(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      const health = await checkHealth();
      setSystemStatus({
        status: health.status || "healthy",
        message: health.message || "All systems operational",
      });
    } catch (error) {
      console.error("Error checking system health:", error);
      setSystemStatus({
        status: "error",
        message: "System health check failed",
      });
    }
  };

  useEffect(() => {
    fetchStats();
    checkSystemStatus();
    loadFiles();
    const intervalId = setInterval(() => {
      fetchStats();
      checkSystemStatus();
    }, refreshInterval * 1000);
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  useEffect(() => {
    loadFileStats(selectedFile);
  }, [selectedFile]);

  const handleRefresh = () => {
    fetchStats();
    checkSystemStatus();
    loadFiles();
    if (selectedFile !== "all") {
      loadFileStats(selectedFile);
    }
  };

  const handleIntervalChange = (value) => {
    setRefreshInterval(Number.parseInt(value));
  };

  const handleFileChange = (fileId) => {
    setSelectedFile(fileId);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getSelectedFileInfo = () => {
    if (selectedFile === "all") return null;
    return files.find((f) => f.file_id === selectedFile);
  };

  const selectedFileInfo = getSelectedFileInfo();

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Last updated: {lastRefreshedString || "Loading..."}
          </p>
          {selectedFileInfo && (
            <div className="flex items-center mt-2 text-sm text-muted-foreground">
              <Database className="w-4 h-4 mr-1" />
              Viewing: {selectedFileInfo.original_filename} ({formatFileSize(selectedFileInfo.file_size)})
              {loadingFileStats && <span className="ml-2">Loading stats...</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFile} onValueChange={handleFileChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select file" />
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
          <Select value={refreshInterval.toString()} onValueChange={handleIntervalChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Refresh interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Refresh every 15s</SelectItem>
              <SelectItem value="30">Refresh every 30s</SelectItem>
              <SelectItem value="60">Refresh every 1m</SelectItem>
              <SelectItem value="300">Refresh every 5m</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} size="icon" variant="outline">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {(loading && !stats) || (loadingFileStats && selectedFile !== "all") ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-[300px]" />
              ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          <KpiCards
            stats={fileStats || stats}
            systemStatus={systemStatus}
            selectedFile={selectedFileInfo}
            isFileSpecific={selectedFile !== "all"}
          />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <VisualAnalytics
                stats={fileStats || stats}
                selectedFile={selectedFileInfo}
                isFileSpecific={selectedFile !== "all"}
              />
            </div>
            <div>
              <RealtimeFeed selectedFileId={selectedFile !== "all" ? selectedFile : null} />
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}