"use client"

import React from 'react'
import { User as UserIcon, PanelLeft } from 'lucide-react' 
import { cls } from './utils'
import Link from 'next/link'

interface HeaderProps {
  sidebarCollapsed: boolean
  setSidebarOpen: (open: boolean) => void
  title?: string
  userData?: {
    full_name?: string
    email?: string
    avatar_url?: string
  } | null
  createNewChat: () => void
}

export default function Header({ 
  sidebarCollapsed, 
  setSidebarOpen, 
  title, 
  userData,
  createNewChat 
}: HeaderProps) {
  
  const getInitials = (name?: string) => {
    if (!name) return "?"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  return (
    <header className="shrink-0 sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200/60 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex items-center gap-2">
        {/* ✅ ADDED: Mobile Sidebar Unlock/Open Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden -ml-2 rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Open Sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>

        <button
          onClick={() => setSidebarOpen(true)}
          className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 hover:opacity-70 transition-opacity"
        >
          CUIConnect
        </button>
      </div>

      {/* Center: Conversation Title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[200px] md:max-w-md">
        <h1 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
      </div>

      {/* Right: Profile Icon */}
      <div className="flex items-center gap-2">
        {userData ? (
          <Link href="/profile" className="group relative h-8 w-8 overflow-hidden rounded-full bg-zinc-100 ring-2 ring-transparent transition hover:ring-zinc-200 dark:bg-zinc-800 dark:hover:ring-zinc-700">
             {userData.avatar_url ? (
               <img src={userData.avatar_url} alt="Profile" className="h-full w-full object-cover" />
             ) : (
               <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                 {getInitials(userData.full_name || userData.email)}
               </div>
             )}
          </Link>
        ) : (
          <Link href="/login" className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
             <UserIcon className="h-4 w-4 text-zinc-500" />
          </Link>
        )}
      </div>

    </header>
  )
}