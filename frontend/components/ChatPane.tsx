"use client"

import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from "react"
import { Pencil, Check, Sparkles, Copy, Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Message as MessageType } from "@/lib/api"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Composer, { ComposerHandle } from "./Composer"

// --- Constants ---
const CUI_LOGO = "https://pbs.twimg.com/profile_images/996764271928381440/gOSs4NlY_400x400.jpg"

const SPINNER_VERBS = [
  "Accomplishing", "Architecting", "Beboppin", "Bootstrapping", "Calculating", "Cascading", 
  "Catapulting", "Choreographing", "Coalescing", "Combobulating", "Computing", "Concocting", 
  "Crystallizing", "Deciphering", "Deliberating", "Discombobulating", "Elucidating", "Envisioning", 
  "Finagling", "Flummoxing", "Generating", "Gesticulating", "Hyperspacing", "Ideating", 
  "Incubating", "Ionizing", "Metamorphosing", "Orbiting", "Orchestrating", "Osmosing", 
  "Philosophising", "Photosynthesizing", "Quantumizing", "Razzle-dazzling", "Recombobulating", 
  "Ruminating", "Shenaniganing", "Synthesizing", "Transfiguring", "Transmuting", "Vibing"
];

// --- Internal Thinking Spinner Component ---
const ThinkingSpinner = () => {
  const [verb, setVerb] = useState(SPINNER_VERBS[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomVerb = SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)];
      setVerb(randomVerb);
    }, 800); // Change verb every 800ms
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2.5 py-1 text-zinc-500 dark:text-zinc-400">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
      <span className="text-sm font-medium animate-pulse italic">{verb}...</span>
    </div>
  );
};

export interface ChatPaneHandle {
  insertTemplate: (content: string) => void;
  focus: () => void;
}

interface ChatPaneProps {
  conversation: {
    id: string
    title: string
    messages: MessageType[]
    updatedAt: string
    preview: string
    pinned: boolean
    folder: string
    messageCount: number
  } | null
  onSend: (content: string) => void
  onEditMessage: (messageId: string, newContent: string) => void
  onResendMessage: (messageId: string) => void
  isThinking: boolean
  onPauseThinking: () => void
  userName?: string
  userAvatar?: string
}

const ChatPane = forwardRef<ChatPaneHandle, ChatPaneProps>(function ChatPane(
  { conversation, onSend, onEditMessage, onResendMessage, isThinking, onPauseThinking, userName, userAvatar },
  ref,
) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const internalComposerRef = useRef<ComposerHandle>(null)

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      const div = scrollRef.current
      div.scrollTop = div.scrollHeight
    }
  }, [conversation?.messages, isThinking])

  useImperativeHandle(ref, () => ({
    insertTemplate: (templateContent: string) => {
      internalComposerRef.current?.insertTemplate(templateContent)
    },
    focus: () => {
      internalComposerRef.current?.focus()
    }
  }), [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  // Empty State (No conversation selected)
  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-white dark:bg-zinc-950">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse" />
          <img src={CUI_LOGO} alt="CUI Logo" className="relative h-20 w-20 rounded-full border-2 border-zinc-100 dark:border-zinc-800 shadow-xl" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">CUI Connect AI</h3>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Your official COMSATS RAG Assistant. Ask me anything about campuses, fees, or departments.
        </p>
      </div>
    )
  }

  const messages = conversation.messages || []

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-white dark:bg-zinc-950 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-8" ref={scrollRef}>
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1
          const isStreaming = isLastMessage && isThinking && msg.role === "assistant"

          return (
            <div 
              key={msg.id} 
              className={cn(
                "group flex gap-4 w-full max-w-3xl mx-auto px-2", 
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* ✅ UPDATED: CUI Logo for Chatbot & Initials for User */}
              <div className={cn(
                "flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border shadow-sm mt-1 overflow-hidden transition-transform group-hover:scale-105",
                msg.role === "user" 
                  ? "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800"
                  : "border-transparent bg-white"
              )}>
                {msg.role === "user" ? (
                  userAvatar ? (
                    <img src={userAvatar} alt="You" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold">{getInitials(userName)}</span>
                  )
                ) : (
                  <img src={CUI_LOGO} alt="CUI" className="h-full w-full object-cover" />
                )}
              </div>

              <div className={cn(
                "flex-1 min-w-0 space-y-1 flex flex-col",
                msg.role === "user" ? "items-end" : "items-start"
              )}>
                {editingId === msg.id ? (
                  <div className="mt-2 space-y-2 text-left w-full max-w-[85%]">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="min-h-[100px] bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-blue-500"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => {
                        onEditMessage(msg.id, draft)
                        setEditingId(null)
                      }} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900">
                        <Check className="w-3 h-3 mr-1"/> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed border transition-all",
                    msg.role === "user" 
                      ? "bg-zinc-100 border-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 rounded-tr-none shadow-sm"
                      : "bg-white border-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-none shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]"
                  )}>
                    {msg.content ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-medium hover:underline" />,
                            code: ({className, children, ...props}) => (
                              <code className={cn("bg-zinc-200/50 dark:bg-zinc-800 rounded px-1.5 py-0.5 font-mono text-[13px]", className)} {...props}>
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {msg.content + (isStreaming ? "▍" : "")}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      /* ✅ UPDATED: Randomized Spinner Verbs */
                      <ThinkingSpinner />
                    )}
                  </div>
                )}
                
                {/* Actions */}
                {!editingId && !isThinking && (
                   <div className={cn(
                       "flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity",
                       msg.role === "user" ? "justify-end" : "justify-start"
                   )}>
                      {msg.role === "user" && (
                         <button onClick={() => { setEditingId(msg.id); setDraft(msg.content); }} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md dark:hover:bg-zinc-800" title="Edit">
                           <Pencil className="w-3.5 h-3.5" />
                         </button>
                      )}
                      {msg.role === "assistant" && (
                        <button onClick={() => handleCopy(msg.content)} className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md dark:hover:bg-zinc-800" title="Copy">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                   </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-zinc-950">
         <div className="mx-auto max-w-3xl">
            <Composer 
                ref={internalComposerRef} 
                onSend={onSend} 
                busy={isThinking} 
            />
         </div>
      </div>
    </div>
  )
})

export default ChatPane