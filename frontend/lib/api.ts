// src/lib/api.ts

// --- Configuration ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const INGESTION_BASE_URL = "https://hammad712-ingestion.hf.space";

// --- Types & Interfaces ---

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: "user" | "admin"; 
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  refresh_token: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  is_summarized: boolean;
}

// --- Helper: Auth Headers ---
const getHeaders = (isJson = true) => {
  const headers: HeadersInit = {};
  if (isJson) {
    headers["Content-Type"] = "application/json";
  }
  
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
};

// --- Helper: Generic Fetch Wrapper ---
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...getHeaders(options.headers?.hasOwnProperty("Content-Type") ? false : true),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "API Request Failed");
  }

  if (response.status === 204) return null as T;

  return response.json();
}

// ==========================================
// 🔐 AUTH METHODS
// ==========================================

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(full_name: string, email: string, password: string): Promise<User> {
  return request<User>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name }),
  });
}

// ==========================================
// 📂 FILE INGESTION UTILITY
// ==========================================

interface IngestionCallbacks {
  onProgress: (progress: number, message: string) => void;
  onError: (message: string) => void;
  onComplete: (downloadUrl: string | null, fileName: string | null) => void;
}

// --- Legacy: Single PDF Stream (XHR based) ---
export const ingestPdfStream = async (
  file: File,
  callbacks: IngestionCallbacks
) => {
  const { onProgress, onError, onComplete } = callbacks;

  if (!file) {
    onError("No file provided");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  const UPLOAD_URL = `${INGESTION_BASE_URL}/process/pdf/stream`; 

  xhr.open("POST", UPLOAD_URL, true);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percentComplete = (event.loaded / event.total) * 100;
      onProgress(percentComplete, `Uploading ${Math.round(percentComplete)}%...`);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const response = JSON.parse(xhr.responseText);
        onComplete(response.download_url, response.filename);
      } catch (e) {
        onComplete(null, null); 
      }
    } else {
      let errorMsg = `Upload failed: ${xhr.statusText}`;
      try {
        const errorResponse = JSON.parse(xhr.responseText);
        if (errorResponse && errorResponse.detail) {
          errorMsg = errorResponse.detail; 
        }
      } catch (e) {
        console.error("Could not parse error response", e);
      }
      onError(errorMsg);
    }
  };

  xhr.onerror = () => {
    onError("Network connection error. Please check your internet.");
  };

  xhr.send(formData);
};

// --- NEW: Bulk/Smart Ingestion (Fetch Stream based) ---

export interface BulkIngestionCallbacks {
  onStatusUpdate: (event: any) => void; // Handles generic events like "batch_start", "file_finished"
  onError: (message: string) => void;
  onComplete: (reportUrl: string | null) => void;
}

export const ingestBulkDocument = async (
  file: File,
  callbacks: BulkIngestionCallbacks
) => {
  const { onStatusUpdate, onError, onComplete } = callbacks;

  if (!file) {
    onError("No file provided");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    // Note: We use the /process/process-document endpoint which supports SSE responses
    const response = await fetch(`${INGESTION_BASE_URL}/process/process-document`, {
      method: "POST",
      body: formData, 
      // Do NOT set Content-Type header manually when using FormData, 
      // the browser sets it with the boundary automatically.
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = "Upload failed";
      try {
        const jsonErr = JSON.parse(errText);
        errMsg = jsonErr.detail || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    if (!response.body) throw new Error("No response stream received");

    // Reading the SSE Stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr) continue;

          try {
            const eventData = JSON.parse(jsonStr);

            // 1. Pass raw event to UI for granular updates (e.g. "Processing file 1/5...")
            onStatusUpdate(eventData);

            // 2. Check for Completion
            if (eventData.event === "batch_completed") {
              onComplete(eventData.master_report_url);
              return; // Stop reading
            }
            if (eventData.event === "completed") {
              onComplete(eventData.report_url);
              return; // Stop reading
            }

            // 3. Check for Fatal Errors
            if (eventData.event === "fatal_error" || eventData.event === "error") {
              onError(eventData.error || "Unknown processing error");
              return;
            }

          } catch (e) {
            console.warn("Failed to parse SSE event:", jsonStr);
          }
        }
      }
    }
  } catch (err: any) {
    onError(err.message || "Network error during bulk processing");
  }
};


// ==========================================
// 🚀 MAIN API OBJECT
// ==========================================

export const api = {
  
  auth: {
    login, 
    signup, 
    logout: () => {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("tokenType");
      localStorage.removeItem("user");
      localStorage.removeItem("authSession");
      window.location.href = "/login";
    },
  },

  user: {
    getProfile: () => 
      request<User>("/users/me"),
    
    updateProfile: (data: { full_name?: string; avatar_url?: string; password?: string }) => 
      request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  chat: {
    list: () => 
      request<ChatSession[]>("/chat/history"),

    getDetails: (threadId: string) => 
      request<Message[]>(`/chat/history/${threadId}`),

    delete: (threadId: string) => 
      request<{ status: string; id: string }>(`/chat/history/${threadId}`, {
        method: "DELETE",
      }),

    rename: (threadId: string, title: string) => 
      request<{ id: string; title: string }>(`/chat/history/${threadId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
  },

  ingestion: {
    list: async () => {
      const res = await fetch(`${INGESTION_BASE_URL}/files/list`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
    
    getDownloadUrl: (filename: string) => {
      return `${INGESTION_BASE_URL}/files/download?filename=${encodeURIComponent(filename)}`;
    },

    delete: async (filename: string) => {
      const res = await fetch(`${INGESTION_BASE_URL}/files/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete file");
      }
      return res.json();
    },

    rename: async (oldFilename: string, newFilename: string) => {
      const res = await fetch(`${INGESTION_BASE_URL}/files/${encodeURIComponent(oldFilename)}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_filename: newFilename }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to rename file");
      }
      return res.json();
    },

    // ✅ Exposed here for convenient access via api.ingestion.uploadBulk(...)
    uploadBulk: ingestBulkDocument
  },

  // --- Message Handling ---
  streamMessage: async (
    message: string, 
    threadId: string | null,
    onChunk: (content: string, threadId?: string) => void,
    onError: (error: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/message/stream`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ message, thread_id: threadId }),
        signal: signal, 
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Stream connection failed");
      }
      
      if (!response.body) throw new Error("No readable stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                onError(parsed.error);
              } else if (parsed.content) {
                onChunk(parsed.content, parsed.thread_id);
              }
            } catch (e) { }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log("Stream stopped by user");
        onDone(); 
      } else {
        onError(err.message || "Stream failed");
      }
    }
  },

  editMessage: async (
    messageId: string, 
    newContent: string,
    onChunk: (content: string) => void,
    onDone: () => void,
    signal?: AbortSignal
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/message/edit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ message_id: messageId, new_content: newContent }),
        signal: signal,
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                console.error("Stream Error:", parsed.error);
                onChunk(`\n\n**Error:** ${parsed.error}`); 
              } else if (parsed.content) {
                onChunk(parsed.content);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error("Edit stream failed", err);
    }
  }
};