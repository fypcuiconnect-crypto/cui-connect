"use client"

import { useState, useEffect } from "react"
import { SPINNER_VERBS } from "@/lib/constants"
import { Loader2 } from "lucide-react"

export default function ThinkingSpinner() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    // Cycle to a new random verb every 800ms
    const interval = setInterval(() => {
      setIndex(Math.floor(Math.random() * SPINNER_VERBS.length))
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 font-medium animate-in fade-in duration-500">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <span className="text-sm italic">
        {SPINNER_VERBS[index]}...
      </span>
    </div>
  )
}