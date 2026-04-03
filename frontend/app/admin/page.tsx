"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { 
  AlertCircle, 
  Upload, 
  FileText, 
  FileJson,
  CheckCircle2,
  ShieldAlert,
  Archive, 
  Loader2,
  Terminal,
  Download,
  Database
} from 'lucide-react'
import { ingestPdfStream, api } from "../../lib/api" 

// --- UI COMPONENTS ---
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary',
  size?: 'default' | 'sm' | 'lg' | 'icon'
}>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-bold uppercase tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    
    const variants = {
      default: "bg-orange-600 text-white hover:bg-zinc-900 shadow-sm",
      secondary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
      outline: "border border-zinc-300 bg-transparent hover:bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800",
      ghost: "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-50",
      destructive: "bg-red-600 text-white hover:bg-red-700"
    }
    const sizes = { default: "h-10 px-4 py-2", sm: "h-8 rounded-sm px-3", lg: "h-11 rounded-md px-8", icon: "h-10 w-10" }
    return <button ref={ref} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ""}`} {...props} />
  }
)
Button.displayName = "Button"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`bg-white dark:bg-zinc-900 rounded-sm border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-950 dark:text-zinc-50 ${className || ""}`} {...props} />
  )
)
Card.displayName = "Card"

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" }>(
  ({ className, variant = "default", ...props }, ref) => (
    <div ref={ref} role="alert" className={`relative w-full rounded-sm border p-4 pl-12 ${
        variant === "destructive" ? "border-red-500/50 text-red-600 bg-red-50 dark:bg-red-900/10" : 
        variant === "success" ? "border-emerald-500/50 text-emerald-900 bg-emerald-50 dark:bg-emerald-900/10" : 
        "bg-zinc-100"
      } ${className || ""}`} {...props} />
  )
)
Alert.displayName = "Alert"

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDark])
  return (
    <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="rounded-full border border-zinc-200 dark:border-zinc-800">
      {isDark ? "🌙" : "☀️"}
    </Button>
  )
}

// --- MAIN COMPONENT ---

export default function AdminDashboard() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false) 

  // Remote files
  const [remoteUploadedPdfs, setRemoteUploadedPdfs] = useState<string[]>([])
  const [remoteGeneratedReports, setRemoteGeneratedReports] = useState<string[]>([])
  const [isFetchingRemote, setIsFetchingRemote] = useState(false)

  // Upload States
  const [isSingleUploading, setIsSingleUploading] = useState(false)
  const [singleProgress, setSingleProgress] = useState(0)
  const [singleStatusMsg, setSingleStatusMsg] = useState("")

  // Bulk States
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkStatusMsg, setBulkStatusMsg] = useState("Waiting for upload...")
  const [bulkLog, setBulkLog] = useState<string[]>([]) 
  const [bulkTotalFiles, setBulkTotalFiles] = useState(0)
  const [bulkProcessedFiles, setBulkProcessedFiles] = useState(0)
  
  // Alert States
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Security Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.user.getProfile().catch(() => null);
        if (user && user.role === 'admin') setAuthorized(true);
        else router.push("/");
      } catch (e) { router.push("/login"); }
    };
    checkAuth();
  }, [router]);

  // Fetch File Lists
  async function fetchRemoteFiles() {
    setIsFetchingRemote(true)
    try {
      const data = await api.ingestion.list()
      setRemoteUploadedPdfs(Array.isArray(data.uploaded_pdfs) ? data.uploaded_pdfs : [])
      setRemoteGeneratedReports(Array.isArray(data.generated_reports) ? data.generated_reports : [])
    } catch (err: any) {
      console.error('Error fetching remote files', err)
    } finally {
      setIsFetchingRemote(false)
    }
  }

  useEffect(() => {
    if(authorized) fetchRemoteFiles()
  }, [authorized])

  // --- DOWNLOAD HANDLER ---
  async function handleDownloadMd(filename: string) {
    try {
      setErrorMessage("")
      // 1. Get the API URL that returns the JSON
      const apiUrl = api.ingestion.getDownloadUrl(filename)
      
      // 2. Fetch the JSON data
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = token ? { "Authorization": `Bearer ${token}` } : {};
      
      const res = await fetch(apiUrl, { headers })
      if (!res.ok) {
         if (res.status === 404) throw new Error("File not found.")
         throw new Error("Failed to generate download link")
      }
      
      const data = await res.json()
      
      // 3. Open the actual signed URL from the JSON response
      if (data.report_download_url) {
        window.open(data.report_download_url, '_blank')
      } else {
        throw new Error("Download URL missing in response")
      }

    } catch (err: any) {
      console.error('Error downloading md', err)
      setErrorMessage(err?.message || 'Failed to download report')
    }
  }

  // --- SINGLE PDF HANDLER ---
  const handleSingleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setErrorMessage("")
    setSuccessMessage("")
    setIsSingleUploading(true)
    setSingleProgress(0)
    setSingleStatusMsg("Starting upload...")

    const file = files[0]
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Only PDF files are allowed")
      setIsSingleUploading(false)
      return
    }

    await ingestPdfStream(file, {
      onProgress: (progress, message) => {
        setSingleProgress(progress)
        setSingleStatusMsg(message)
      },
      onError: (msg) => {
        setErrorMessage(msg)
        setIsSingleUploading(false)
      },
      onComplete: () => {
         setSingleProgress(100)
         setSingleStatusMsg("Complete")
         setSuccessMessage("PDF successfully processed.")
         setTimeout(() => setIsSingleUploading(false), 1000)
         fetchRemoteFiles()
      }
    })
    event.target.value = ""
  }

  // --- BULK ZIP HANDLER ---
  const handleBulkFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErrorMessage("Only ZIP archives are allowed for bulk upload.")
      return
    }

    setErrorMessage("")
    setSuccessMessage("")
    setIsBulkUploading(true)
    setBulkStatusMsg("Initializing...")
    setBulkLog([]) 
    setBulkTotalFiles(0)
    setBulkProcessedFiles(0)

    await api.ingestion.uploadBulk(file, {
      onStatusUpdate: (eventData) => {
        const time = new Date().toLocaleTimeString().split(" ")[0];
        let logMsg = "";
        
        switch (eventData.event) {
          case "initialized":
            logMsg = `Job ID: ${eventData.job_id.slice(0, 8)}...`;
            setBulkStatusMsg("Job Initialized");
            break;
          case "upload_complete":
            logMsg = `Source uploaded to storage.`;
            setBulkStatusMsg("Source Uploaded");
            break;
          case "processing_started":
            logMsg = `Pipeline mode: ${eventData.mode}`;
            setBulkStatusMsg("Server Processing...");
            break;
          case "batch_start":
            logMsg = `Batch detected: ${eventData.total_files} files`;
            setBulkTotalFiles(eventData.total_files);
            setBulkStatusMsg(`Processing...`);
            break;
          case "file_finished":
            logMsg = `✓ Processed: ${eventData.filename}`;
            setBulkProcessedFiles(prev => prev + 1);
            break;
          case "batch_completed":
             if (eventData.stats) {
               logMsg = `DONE. Success: ${eventData.stats.processed}, Failed: ${eventData.stats.failed}`;
               setBulkProcessedFiles(eventData.stats.processed + eventData.stats.failed); 
             } else {
               logMsg = `Batch processed: ${eventData.processed} files.`;
               setBulkProcessedFiles(eventData.processed);
             }
            break;
          case "error":
          case "fatal_error":
            logMsg = `ERROR: ${eventData.error}`;
            break;
          default:
            logMsg = `Event: ${eventData.event}`;
        }

        if (logMsg) {
          setBulkLog(prev => [`[${time}] ${logMsg}`, ...prev].slice(0, 20))
        }
      },
      onError: (msg) => {
        setErrorMessage(msg)
        setIsBulkUploading(false)
      },
      onComplete: (reportUrl) => {
        setBulkStatusMsg("Finished")
        setSuccessMessage("Batch processing finished.")
        setIsBulkUploading(false)
        fetchRemoteFiles()
        if (reportUrl) window.open(reportUrl, '_blank')
      }
    })
    event.target.value = ""
  }

  // Calculate percentage
  const bulkPercentage = bulkTotalFiles > 0 
    ? Math.round((bulkProcessedFiles / bulkTotalFiles) * 100) 
    : 0;

  if (!authorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <ShieldAlert className="h-12 w-12 animate-pulse" />
          <p>Verifying Admin Privileges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-8 relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans">
      
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-5 text-zinc-900 dark:text-white pointer-events-none"
        style={{ backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />

      {/* Header */}
      <div className="relative z-10 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push("/")} className="inline-flex">Back</Button>
          <div className="text-center mx-4 flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">PDF Management</h1>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <Alert variant="destructive" className="mb-6 flex items-center">
          <AlertCircle className="h-5 w-5 absolute left-4" />
          <span className="ml-2 font-medium">{errorMessage}</span>
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" className="mb-6 flex items-center">
          <CheckCircle2 className="h-5 w-5 absolute left-4" />
          <span className="ml-2 font-medium">{successMessage}</span>
        </Alert>
      )}

      {/* Upload Section */}
      <div className="grid md:grid-cols-2 gap-6 mb-8 relative z-10">
        
        {/* SINGLE UPLOAD CARD */}
        <Card className={`group relative overflow-hidden transition-all duration-300 ${isSingleUploading ? 'border-orange-500 ring-1 ring-orange-500' : 'hover:border-orange-500'}`}>
          <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-300 ${isSingleUploading ? 'bg-orange-600' : 'bg-zinc-200 dark:bg-zinc-800 group-hover:bg-orange-600'}`} />
          <div className="p-6 md:p-8 pl-8">
            <div className="flex items-center gap-3 mb-4">
              <Upload className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase">Single PDF Upload</h2>
            </div>
            
            <div className="space-y-4">
              <label className="block">
                <div className={`relative border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all ${isSingleUploading ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-zinc-300 hover:border-orange-500'}`}>
                  <input type="file" accept=".pdf" onChange={handleSingleFileUpload} disabled={isSingleUploading || isBulkUploading} className="hidden" />
                  <FileText className={`w-12 h-12 mx-auto mb-3 transition-colors ${isSingleUploading ? 'text-orange-500 animate-pulse' : 'text-zinc-400 group-hover:text-orange-500'}`} />
                  <p className="font-bold uppercase text-sm">{isSingleUploading ? "Processing..." : "Click to browse"}</p>
                </div>
              </label>

              {isSingleUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold uppercase">
                    <span>{singleStatusMsg}</span>
                    <span className="text-orange-600">{Math.round(singleProgress)}%</span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-orange-600 h-full transition-all duration-300" style={{ width: `${singleProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* BULK UPLOAD CARD */}
        <Card className={`group relative overflow-hidden transition-all duration-300 ${isBulkUploading ? 'border-emerald-500 ring-1 ring-emerald-500' : 'hover:border-emerald-500'}`}>
          <div className={`absolute top-0 left-0 w-1 h-full transition-colors duration-300 ${isBulkUploading ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-800 group-hover:bg-emerald-600'}`} />
          <div className="p-6 md:p-8 pl-8">
            <div className="flex items-center gap-3 mb-4">
              <Archive className="w-6 h-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white uppercase">Bulk Upload (ZIP)</h2>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className={`relative border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all ${isBulkUploading ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-zinc-300 hover:border-emerald-500'}`}>
                  <input type="file" accept=".zip" onChange={handleBulkFileUpload} disabled={isSingleUploading || isBulkUploading} className="hidden" />
                  {isBulkUploading ? (
                    <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin text-emerald-500" />
                  ) : (
                    <Archive className="w-12 h-12 mx-auto mb-3 text-zinc-400 group-hover:text-emerald-500" />
                  )}
                  <p className="font-bold uppercase text-sm">{isBulkUploading ? "Processing Batch..." : "Upload ZIP Archive"}</p>
                </div>
              </label>

              {/* LIVE LOGS & PROGRESS */}
              {isBulkUploading && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-emerald-600">
                            <span>{bulkProcessedFiles} / {bulkTotalFiles || "?"} Files</span>
                            <span>{bulkPercentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                             <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${bulkPercentage}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-zinc-950 p-3 rounded-sm text-xs font-mono text-emerald-400 border border-zinc-800 shadow-inner">
                        <div className="flex items-center gap-2 mb-2 border-b border-zinc-800 pb-2">
                            <Terminal className="w-3 h-3" />
                            <span className="uppercase tracking-widest">Server Events</span>
                        </div>
                        <div className="space-y-1 h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 font-medium">
                            {bulkLog.length === 0 && <span className="text-zinc-600 italic">Initializing connection...</span>}
                            {bulkLog.map((log, i) => (
                              <div key={i} className="truncate tracking-tight">{log}</div>
                            ))}
                        </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* REMOTE FILES LISTS */}
      <div className="grid md:grid-cols-2 gap-6 mb-6 relative z-10">
        
        {/* LEFT: UPLOADED PDFS (No Download) */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-orange-600" />
              <h2 className="text-lg font-bold uppercase">Remote PDFs ({remoteUploadedPdfs.length})</h2>
              <Button variant="ghost" size="sm" onClick={fetchRemoteFiles} className="ml-auto">Refresh</Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {remoteUploadedPdfs.length === 0 && <div className="text-sm text-zinc-500 italic p-2">No files found.</div>}
              {remoteUploadedPdfs.map((name) => (
                <div key={name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-sm border border-zinc-100 dark:border-zinc-800">
                  <div className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300 w-2/3" title={name}>{name}</div>
                  <span className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded border border-zinc-200 dark:border-zinc-700 font-medium">Source</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* RIGHT: GENERATED REPORTS (With Download) */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileJson className="w-6 h-6 text-emerald-600" />
              <h2 className="text-lg font-bold uppercase">Reports ({remoteGeneratedReports.length})</h2>
              <Button variant="ghost" size="sm" onClick={fetchRemoteFiles} className="ml-auto">Refresh</Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {remoteGeneratedReports.length === 0 && <div className="text-sm text-zinc-500 italic p-2">No reports found.</div>}
              {remoteGeneratedReports.map((name) => (
                <div key={name} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-sm border border-zinc-100 dark:border-zinc-800">
                  <div className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300 w-2/3" title={name}>{name}</div>
                  <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => handleDownloadMd(name)}>
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}