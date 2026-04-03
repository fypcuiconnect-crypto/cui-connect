"use client"
import React, { useState, useRef, useEffect } from "react"
import { Trash2, MessageSquare, Pencil, Check, X } from "lucide-react" // ✅ Replaced Pin with Pencil
import { cls, timeAgo } from "./utils"
import { ChatSession } from "@/lib/api"

interface ConversationRowProps {
  data: ChatSession
  active: boolean
  onSelect: () => void
  onDelete: () => void
  onRename?: (newTitle: string) => void // ✅ Added onRename prop
  onTogglePin?: () => void // Kept optional for compatibility
  showMeta?: boolean
}

export default function ConversationRow({
  data,
  active,
  onSelect,
  onDelete,
  onRename,
  showMeta = true,
}: ConversationRowProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(data.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isRenaming])

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (renameValue.trim() && onRename) {
      onRename(renameValue.trim())
    } else {
      setRenameValue(data.title) // Revert if empty
    }
    setIsRenaming(false)
  }

  const handleCancelRename = () => {
    setRenameValue(data.title)
    setIsRenaming(false)
  }

  return (
    <div
      className={cls(
        "group relative flex cursor-pointer flex-col gap-1 rounded-lg px-3 py-3 transition-colors",
        active
          ? "bg-zinc-100 dark:bg-zinc-800"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
      )}
      onClick={() => !isRenaming && onSelect()}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <MessageSquare
            className={cls(
              "h-4 w-4 shrink-0",
              active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"
            )}
          />
          
          {isRenaming ? (
            // ✅ Rename Input Mode
            <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
               <input 
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit()
                    if (e.key === 'Escape') handleCancelRename()
                  }}
                  onBlur={handleCancelRename}
               />
               {/* Note: Buttons might be redundant if we use Enter/Blur, but kept for clarity */}
            </div>
          ) : (
            // ✅ Standard Title Mode
            <span
              className={cls(
                "truncate text-sm font-medium",
                active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"
              )}
            >
              {data.title || "New Chat"}
            </span>
          )}
        </div>

        {/* Actions (Rename & Delete) */}
        {!isRenaming && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {onRename && (
                <button
                    onClick={(e) => {
                    e.stopPropagation()
                    setIsRenaming(true)
                    }}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    title="Rename"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
            )}
            <button
                onClick={(e) => {
                e.stopPropagation()
                onDelete()
                }}
                className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                title="Delete"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
            </div>
        )}
      </div>

      {/* Meta Info */}
      {showMeta && !isRenaming && (
        <div className="flex items-center justify-between px-6">
          <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">
            {timeAgo(data.created_at || new Date().toISOString())}
          </span>
          {/* ✅ Only show message count if > 0 */}
          {data.message_count && data.message_count > 0 ? (
             <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
               {data.message_count}
             </span>
          ) : null}
        </div>
      )}
    </div>
  )
}