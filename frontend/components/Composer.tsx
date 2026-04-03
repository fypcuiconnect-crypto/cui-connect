"use client"

import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { Send, Loader2 } from "lucide-react"
import { liteClient as algoliasearch } from "algoliasearch/lite"
import { cn } from "@/lib/utils"

// Initialize Algolia Client (v5)
const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!
);

export interface ComposerHandle {
  insertTemplate: (templateContent: string) => void;
  focus: () => void;
}

interface ComposerProps {
  onSend: (text: string) => Promise<void> | void;
  busy: boolean;
}

const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({ onSend, busy }, ref) {
  const [value, setValue] = useState("")
  const [suggestion, setSuggestion] = useState("")
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 🚀 Real-time Autocomplete Logic (Algolia v5)
  useEffect(() => {
    if (value.length < 3) {
      setSuggestion("");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { results } = await searchClient.search({
          requests: [
            {
              indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!,
              query: value,
              hitsPerPage: 1,
            },
          ],
        });

        // Extract hits from the first result
        const hits = (results[0] as any).hits;

        if (hits && hits.length > 0) {
          // Change 'query' to whatever your Algolia field name is (e.g., 'text' or 'question')
          const result = hits[0].query || hits[0].text || hits[0].question;
          
          if (result && result.toLowerCase().startsWith(value.toLowerCase())) {
            setSuggestion(result);
          } else {
            setSuggestion("");
          }
        } else {
          setSuggestion("");
        }
      } catch (err) {
        console.error("Autocomplete fetch error:", err);
        setSuggestion("");
      }
    }, 150); // 150ms debounce to save API quota

    return () => clearTimeout(timer);
  }, [value]);

  useImperativeHandle(ref, () => ({
    insertTemplate: (content: string) => {
      setValue((prev) => (prev ? `${prev}\n\n${content}` : content));
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    focus: () => inputRef.current?.focus(),
  }), [value])

  async function handleSend() {
    if (!value.trim() || sending || busy) return
    const textToSend = value; 
    setSending(true)
    
    try {
      await onSend?.(textToSend)
      setValue("")
      setSuggestion("")
      setTimeout(() => inputRef.current?.focus(), 10)
    } catch (e) {
      console.error("Failed to send:", e)
      setValue(textToSend) // Restore text on error
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // ⌨️ Tab to Complete
    if (e.key === "Tab" && suggestion) {
      e.preventDefault();
      setValue(suggestion);
      setSuggestion("");
    }
    // ⌨️ Enter to Send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative w-full">
      <div className={cn(
        "relative flex items-end gap-2 rounded-3xl border bg-white shadow-sm dark:bg-zinc-950 transition-all duration-200",
        "border-zinc-300 dark:border-zinc-700 p-2 pl-4",
        (busy || sending) && "opacity-80"
      )}>
        
        <div className="relative flex-1 min-h-[40px]">
          {/* 👻 Ghost Suggestion Layer */}
          {suggestion && (
            <div 
              className="absolute inset-0 pointer-events-none text-sm py-2.5 px-0 text-zinc-300 dark:text-zinc-600 whitespace-pre-wrap break-words leading-relaxed"
              aria-hidden="true"
            >
              <span className="opacity-0">{value}</span>
              <span>{suggestion.substring(value.length)}</span>
            </div>
          )}

          {/* ✍️ Real Textarea */}
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CUI Connect..."
            rows={1}
            spellCheck={false}
            className={cn(
              "relative z-10 w-full resize-none bg-transparent outline-none placeholder:text-zinc-400",
              "text-sm py-2.5 max-h-[200px] block leading-relaxed",
              "text-zinc-900 dark:text-zinc-100"
            )}
          />
        </div>

        {/* 📤 Send Button */}
        <button
          onClick={() => handleSend()}
          disabled={sending || busy || !value.trim()}
          className={cn(
            "mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all",
            "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm",
            "hover:scale-105 active:scale-95",
            (sending || busy || !value.trim()) && "opacity-50 cursor-not-allowed scale-100"
          )}
        >
          {sending || busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4 ml-0.5" />
          )}
        </button>
      </div>

      {/* 💡 Keyboard Hints */}
      <div className="mt-2 flex justify-center gap-4 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
        {suggestion ? (
          <span className="text-blue-500 dark:text-blue-400 animate-pulse">Tab to autocomplete</span>
        ) : (
          <span>Enter to send · Shift+Enter for newline</span>
        )}
      </div>
    </div>
  )
})

export default Composer