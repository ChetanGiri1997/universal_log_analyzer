// API service for interacting with the backend

// Base API URL - pointing to the actual backend
const API_BASE_URL = "http://localhost:8000";

// Helper function for API requests
async function fetchAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  // Validate endpoint
  if (!endpoint || typeof endpoint !== "string" || endpoint.trim() === "") {
    throw new Error("Invalid endpoint provided");
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const defaultOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (jsonError) {
        // If JSON parsing fails, use the default error message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    console.error(`API Error (${url}):`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      endpoint,
      options,
    });
    throw new Error(`Failed to fetch from ${url}: ${error.message}`);
  }
}

// Dashboard API
export async function fetchDashboardStats() {
  return fetchAPI("/api/stats");
}

// Logs API
export async function fetchLogs(filters: any) {
  return fetchAPI("/api/logs/query", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}

export async function fetchRecentLogs() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  try {
    const response = await fetchAPI("/api/logs/query", {
      method: "POST",
      body: JSON.stringify({
        start_time: fiveMinutesAgo.toISOString(),
        end_time: now.toISOString(),
        limit: 10,
        offset: 0,
      }),
    });
    return response.logs || [];
  } catch (error: any) {
    console.error("fetchRecentLogs error:", {
      message: error.message,
      start_time: fiveMinutesAgo.toISOString(),
      end_time: now.toISOString(),
    });
    throw error;
  }
}

// Templates API
export async function fetchTemplates() {
  return fetchAPI("/api/templates");
}

export async function fetchTemplateDetails(templateId: string) {
  return fetchTemplates().then((templates) =>
    templates.find((t) => t.template_id.toString() === templateId)
  );
}

// Files API
export async function fetchFiles() {
  return fetchAPI("/api/files");
}

// Generate file statistics from logs query
export async function fetchFileStats(fileId: string) {
  try {
    const response = await fetchAPI("/api/logs/query", {
      method: "POST",
      body: JSON.stringify({
        file_id: fileId,
        template_id: null,
        start_time: null,
        end_time: null,
        level: null,
        source: null,
        message_contains: null,
        log_type: null,
        has_network_info: null,
        protocol: null,
        ip_address: null,
        limit: 10000,
        offset: 0,
      }),
    });

    const logs = response.logs || [];
    const totalLogs = response.total_count || logs.length;

    const levelCounts: { [key: string]: number } = {};
    const logTypeCounts: { [key: string]: number } = {};
    const sourceCounts: { [key: string]: number } = {};
    let networkInfoCount = 0;
    let errorCount = 0;

    logs.forEach((log: any) => {
      levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
      if (log.log_type) {
        logTypeCounts[log.log_type] = (logTypeCounts[log.log_type] || 0) + 1;
      }
      if (log.source) {
        sourceCounts[log.source] = (sourceCounts[log.source] || 0) + 1;
      }
      if (log.network_info) {
        networkInfoCount++;
      }
      if (log.level === "ERROR") {
        errorCount++;
      }
    });

    const level_distribution = Object.entries(levelCounts).map(([level, count]) => ({
      _id: level,
      count,
    }));

    const log_type_distribution = Object.entries(logTypeCounts).map(([type, count]) => ({
      _id: type,
      count,
    }));

    const top_sources = Object.entries(sourceCounts).map(([source, count]) => ({
      _id: source,
      count,
    }));

    const hourlyActivity: { [key: string]: number } = {};
    logs.forEach((log: any) => {
      const hour = new Date(log.timestamp).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });

    const hourly_activity = Object.entries(hourlyActivity).map(([hour, count]) => ({
      _id: hour.toString().padStart(2, "0") + ":00",
      count,
    }));

    return {
      file_id: fileId,
      total_logs: totalLogs,
      error_rate: totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0,
      level_distribution,
      log_type_distribution,
      top_sources,
      hourly_activity,
      network_info_stats: {
        total_with_network_info: networkInfoCount,
        total_without_network_info: totalLogs - networkInfoCount,
      },
      top_templates: [],
      error_trends: [],
    };
  } catch (error: any) {
    console.error("Error generating file stats:", {
      message: error.message,
      fileId,
    });
    throw error;
  }
}

export async function uploadFile(formData: FormData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`File upload failed with status ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    console.error("File upload error:", error);
    throw error;
  }
}

// Health check
export async function checkHealth() {
  return fetchAPI("/api/health");
}

// Ingest a single log entry
export async function ingestLog(logEntry: any) {
  return fetchAPI("/api/logs/ingest", {
    method: "POST",
    body: JSON.stringify(logEntry),
  });
}

// Ingest Fluent Bit logs
export async function ingestFluentBitLogs(logs: any[]) {
  return fetchAPI("/api/logs/ingest/fluent-bit", {
    method: "POST",
    body: JSON.stringify(logs),
  });
}

// Convert frontend filter format to API's LogQueryRequest format
export function convertFiltersToQueryRequest(filters: any) {
  return {
    template_id: filters.templateId
      ? isNaN(Number(filters.templateId))
        ? filters.templateId
        : Number(filters.templateId)
      : null,
    start_time: filters.startTime || null,
    end_time: filters.endTime || null,
    level: filters.logLevels && filters.logLevels.length === 1 ? filters.logLevels[0] : null,
    source: filters.source || null,
    message_contains: filters.searchText || null,
    file_id: filters.fileId || null,
    log_type: filters.logType || null,
    has_network_info: filters.hasNetworkInfo || null,
    protocol: filters.protocol || null,
    ip_address: filters.ipAddress || null,
    limit: filters.limit || 100,
    offset: filters.offset || 0,
  };
}

// Get unique sources from logs
export async function fetchSources() {
  try {
    const stats = await fetchDashboardStats();
    return stats.sources || [];
  } catch (error: any) {
    console.error("Error fetching sources:", error);
    return [];
  }
}