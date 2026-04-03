"use client"
import { motion, AnimatePresence } from "framer-motion"
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  Search as SearchIcon, 
  Plus, 
  Clock, 
  LogIn,
  Database 
} from 'lucide-react'
import SidebarSection from "./SidebarSection"
import ConversationRow from "./ConversationRow"
import ThemeToggle from "./ThemeToggle"
import SearchModal from "./SearchModal"
import { cls } from "./utils"
import { useState, useEffect, useRef } from "react"
import { api, ChatSession, User } from "@/lib/api"
import Link from "next/link"

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  theme: string;
  setTheme: (theme: string) => void;
  collapsed: { recent: boolean; pinned?: boolean };
  setCollapsed: React.Dispatch<React.SetStateAction<any>>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
  conversations?: any[]; 
  pinned?: any[];
  recent?: any[];
  togglePin?: any;
  query?: any;
  setQuery?: any;
  searchRef?: any;
  createNewChat?: any;
  userData: User | null;
  onDeleteChat: (id: string) => void;
}

// Simple in-memory cache
let cachedConversations: ChatSession[] | null = null;
let cachedUser: User | null = null;

export default function Sidebar({
  open,
  onClose,
  theme,
  setTheme,
  collapsed,
  setCollapsed,
  selectedId,
  onSelect,
  sidebarCollapsed = false,
  setSidebarCollapsed = () => {},
  conversations: propConversations = [], 
  userData: propUserData = null,
  onDeleteChat,
  createNewChat
}: SidebarProps) {
  const [mounted, setMounted] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false) 

  // ✅ Initialize state with props if available, otherwise cache
  const [internalConversations, setInternalConversations] = useState<ChatSession[]>(
    propConversations.length > 0 ? propConversations : (cachedConversations || [])
  )
  const [internalUser, setInternalUser] = useState<User | null>(cachedUser)
  const [loading, setLoading] = useState(!cachedConversations) 
  
  // ✅ Use internal state as the source of truth for rendering
  const conversations = internalConversations;
  const userData = propUserData || internalUser

  const hasFetched = useRef(!!cachedConversations);

  // ✅ Sync prop changes to internal state
  useEffect(() => {
    if (propConversations.length > 0) {
      setInternalConversations(propConversations)
    }
  }, [propConversations])

  useEffect(() => {
    setMounted(true)
    
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)

    if (propConversations.length === 0) {
        const fetchData = async () => {
        if (hasFetched.current) {
            setLoading(false);
            return;
        }
        hasFetched.current = true;

        const localUser = localStorage.getItem("user")
        if (localUser && !cachedUser) {
            try { 
                const parsed = JSON.parse(localUser)
                setInternalUser(parsed) 
                cachedUser = parsed
            } catch (e) {}
        }

        try {
            setLoading(true)
            const [chats, profile] = await Promise.allSettled([
            api.chat.list().catch(() => []),
            api.user.getProfile().catch(() => null)
            ])

            if (chats.status === "fulfilled") {
            const newChats = chats.value || []
            setInternalConversations(newChats)
            cachedConversations = newChats 
            }
            
            if (profile.status === "fulfilled" && profile.value) {
            setInternalUser(profile.value)
            cachedUser = profile.value
            localStorage.setItem("user", JSON.stringify(profile.value))
            } else if (profile.status === "fulfilled" && !profile.value) {
            setInternalUser(null) 
            cachedUser = null
            }
        } catch (error) {
            console.error("Failed to fetch sidebar data", error)
        } finally {
            setLoading(false)
        }
        }
        fetchData()
    } else {
        setLoading(false)
    }

    return () => window.removeEventListener('resize', checkMobile)
  }, [propConversations.length])

  // ✅ Helper to refresh the list from server
  const refreshChats = async () => {
    try {
      const chats = await api.chat.list();
      setInternalConversations(chats);
      cachedConversations = chats;
    } catch (e) {
      console.error("Failed to refresh chats", e);
    }
  };

  const handleCreateChat = () => {
    if (createNewChat) createNewChat() 
    else onSelect(null) 
    
    if (window.innerWidth < 768) onClose()
  }

  // ✅ ENHANCED: Auto-refreshing Delete Handler
  const handleDeleteChat = async (id: string) => {
    try {
        // 1. Optimistic Update: Immediately remove from UI
        const updated = internalConversations.filter(c => c.id !== id)
        setInternalConversations(updated)
        cachedConversations = updated 
        
        if (selectedId === id) onSelect(null)

        // 2. Execute Backend Delete
        if (onDeleteChat) {
          onDeleteChat(id) // Use parent prop if provided
        } else {
          await api.chat.delete(id)
        }

        // 3. Background Refresh: Ensure UI is 100% correct
        await refreshChats();

    } catch (e) {
        console.error("Delete failed", e)
        // Recover state on failure
        refreshChats(); 
    }
  }

  // ✅ ENHANCED: Auto-refreshing Rename Handler
  const handleRenameChat = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
        // 1. Optimistic Update: Change title immediately
        const updated = internalConversations.map(c => 
            c.id === id ? { ...c, title: newTitle } : c
        )
        setInternalConversations(updated)
        cachedConversations = updated

        // 2. API Call
        await api.chat.rename(id, newTitle)

        // 3. Re-fetch ground truth
        await refreshChats();

    } catch (e) {
        console.error("Rename failed", e)
        refreshChats(); 
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return "?"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const renderUserSection = () => {
    if (!mounted) return <div className="h-12 w-full animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl" />

    if (userData) {
      return (
        <Link 
          href="/profile"
          className="mt-2 flex items-center gap-2 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition cursor-pointer"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-900 overflow-hidden">
            {userData.avatar_url ? (
              <img src={userData.avatar_url} alt="User" className="h-full w-full object-cover" />
            ) : (
              getInitials(userData.full_name || userData.email)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{userData.full_name || "User"}</div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{userData.email}</div>
          </div>
        </Link>
      )
    }

    return (
      <Link 
          href="/login" 
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
      >
          <LogIn className="h-4 w-4" /> Log In
      </Link>
    )
  }

  if (sidebarCollapsed) {
    return (
      <motion.aside
        initial={{ width: 320 }}
        animate={{ width: 64 }}
        className="z-[100] flex h-full shrink-0 flex-col border-r border-zinc-200/60 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-center border-b border-zinc-200/60 px-3 py-3 dark:border-zinc-800">
          <button onClick={() => setSidebarCollapsed(false)} className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 pt-4">
          <button onClick={handleCreateChat} className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="New Chat">
            <Plus className="h-5 w-5" />
          </button>
          <button onClick={() => setShowSearchModal(true)} className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Search">
            <SearchIcon className="h-5 w-5" />
          </button>
          
          {/* ✅ Mini Sidebar: Admin Button */}
          {userData?.role === 'admin' && (
            <Link href="/admin">
              <button className="rounded-xl p-2 text-zinc-500 hover:bg-orange-100 hover:text-orange-600 dark:text-zinc-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-500" title="Admin Dashboard">
                <Database className="h-5 w-5" />
              </button>
            </Link>
          )}
        </div>
      </motion.aside>
    )
  }

  const shouldRenderSidebar = !isMobile || open

  return (
    <>
      <AnimatePresence>
        {open && isMobile && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/60 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shouldRenderSidebar && (
          <motion.aside
            key="sidebar"
            initial={{ x: isMobile ? -340 : 0 }}
            animate={{ x: 0 }}
            exit={{ x: -340 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className={cls(
              "z-[100] flex h-full w-80 shrink-0 flex-col border-r border-zinc-200/60 bg-white dark:border-zinc-800 dark:bg-zinc-900",
              isMobile ? "fixed inset-y-0 left-0" : "static translate-x-0"
            )}
          >
            {/* Header Section */}
            <div className="flex flex-col">
              
              <div className="flex items-center justify-between px-3 py-3">
                <button 
                  onClick={() => setShowSearchModal(true)} 
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  title="Search Chats"
                >
                  <SearchIcon className="h-5 w-5" />
                </button>

                <div className="flex items-center">
                    <button 
                      onClick={() => setSidebarCollapsed(true)} 
                      className="hidden md:block rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      title="Collapse Sidebar"
                    >
                      <PanelLeftClose className="h-5 w-5" />
                    </button>

                    <button 
                      onClick={onClose} 
                      className="md:hidden rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <PanelLeftClose className="h-5 w-5" />
                    </button>
                </div>
              </div>

              <div className="h-px w-full bg-zinc-200/60 dark:bg-zinc-800"></div>

              <div className="px-3 py-3">
                <button 
                    onClick={handleCreateChat} 
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                >
                    <Plus className="h-4 w-4" />
                    <span>Start New Chat</span>
                </button>
              </div>

            </div>

            {/* Chat List */}
            <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 pb-4 pt-2">
              <SidebarSection
                icon={<Clock className="h-4 w-4" />}
                title={"RECENT CHATS"}
                collapsed={collapsed.recent}
                onToggle={() => setCollapsed((s: any) => ({ ...s, recent: !s.recent }))}
              >
                {!mounted || (loading && !cachedConversations && propConversations.length === 0) ? (
                    <div className="px-4 py-2 text-xs text-zinc-400">Loading chats...</div>
                ) : conversations.length === 0 ? (
                  <div className="select-none rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    No conversations yet.
                  </div>
                ) : (
                  conversations.map((c) => (
                    <ConversationRow
                      key={c.id}
                      data={c}
                      active={c.id === selectedId}
                      onSelect={() => {
                        onSelect(c.id)
                        if (isMobile) onClose()
                      }}
                      onRename={(newTitle: string) => handleRenameChat(c.id, newTitle)}
                      onDelete={() => handleDeleteChat(c.id)}
                      showMeta={true}
                    />
                  ))
                )}
              </SidebarSection>
            </nav>

            <div className="mt-auto border-t border-zinc-200/60 px-3 py-3 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                 
                 {/* ✅ ADMIN BUTTON: Aligned Left */}
                 {userData?.role === 'admin' && (
                    <Link href="/admin">
                      <button 
                        className="rounded-xl p-2 text-zinc-500 hover:bg-orange-100 hover:text-orange-600 dark:text-zinc-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-500 transition-colors"
                        title="Admin Ingestion Dashboard"
                      >
                        <Database className="h-5 w-5" />
                      </button>
                    </Link>
                 )}

                 {/* THEME TOGGLE: Aligned Right */}
                 <div className={userData?.role !== 'admin' ? "ml-auto" : ""}> 
                    <ThemeToggle theme={theme} setTheme={setTheme} />
                 </div>
              </div>
              
              {renderUserSection()}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        conversations={conversations}
        selectedId={selectedId}
        onSelect={onSelect}
        togglePin={() => {}} 
        createNewChat={handleCreateChat}
      />
    </>
  )
}