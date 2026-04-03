"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AIAssistantUI from '@/components/AIAssistantUI'

export default function ChatPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Auth Check
    const token = localStorage.getItem('accessToken')
    if (token) {
      setIsAuthenticated(true)
    } else {
      router.push('/login')
    }
    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <span className="ml-2 text-sm">Initializing CUI Connect...</span>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* The AIAssistantUI component should internalize the Composer we updated above */}
      <AIAssistantUI />
    </div>
  )
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}