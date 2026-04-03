"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { api } from "@/lib/api"
import { ArrowLeft, Upload, User as UserIcon } from "lucide-react"

export default function ProfilePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    newPassword: "",
    confirmPassword: "",
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState("")

  // --- 1. Load User Data ---
  useEffect(() => {
    setMounted(true)
    const loadUserData = async () => {
      try {
        const user = await api.user.getProfile()
        
        setFormData(prev => ({
          ...prev,
          name: user.full_name || "",
          email: user.email || "",
        }))

        if (user.avatar_url) {
          setProfileImage(user.avatar_url)
        }
      } catch (err) {
        console.error("Error loading user:", err)
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [router])

  // --- 2. Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
    if (errors[id]) setErrors(prev => ({ ...prev, [id]: "" }))
  }

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, profileImage: "Please upload a valid image file" }))
        return
      }
      if (file.size > 5 * 1024 * 1024) { 
        setErrors(prev => ({ ...prev, profileImage: "Image size should be less than 5MB" }))
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setPreviewImage(result)
        setErrors(prev => ({ ...prev, profileImage: "" }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrors({})
    setSuccessMessage("")

    try {
      const newErrors: Record<string, string> = {}
      if (!formData.name.trim()) newErrors.name = "Name is required"
      
      if (formData.newPassword || formData.confirmPassword) {
        if (formData.newPassword.length < 6) {
          newErrors.newPassword = "Password must be at least 6 characters"
        }
        if (formData.newPassword !== formData.confirmPassword) {
          newErrors.confirmPassword = "Passwords do not match"
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        setIsSaving(false)
        return
      }

      const payload: { full_name?: string; avatar_url?: string; password?: string } = {
        full_name: formData.name,
      }

      if (previewImage) {
        payload.avatar_url = previewImage
      }

      if (formData.newPassword) {
        payload.password = formData.newPassword
      }

      const updatedUser = await api.user.updateProfile(payload)

      if (updatedUser.avatar_url) {
        setProfileImage(updatedUser.avatar_url)
      }
      setPreviewImage(null)
      
      const cachedUser = localStorage.getItem("user")
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser)
        localStorage.setItem("user", JSON.stringify({ 
          ...parsed, 
          ...updatedUser 
        }))
      }

      setFormData(prev => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
      }))

      setSuccessMessage("Profile updated successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)

    } catch (error: any) {
      setErrors({ submit: error.message || "Failed to save profile" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    api.auth.logout()
    router.push("/login")
  }

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-[#002A54] text-foreground transition-colors">
        <div className="text-center">
          {/* ✅ Spinner: CUI Navy Color */}
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#002A54] dark:border-blue-900 dark:border-t-white"></div>
          <p className="mt-4 text-sm font-medium opacity-70">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    // ✅ Main Container: CUI Dark Mode Support
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden pb-8 bg-background transition-colors duration-300">
      
      {/* Light Mode Gradient: Subtle Blue */}
      <div 
        className="absolute inset-0 -z-10 dark:hidden"
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #f0f7ff 35%, #e0efff 65%, #d1e5ff 100%)"
        }}
      ></div>
      
      {/* Dark Mode Gradient: CUI Navy Radial */}
      <div 
        className="absolute inset-0 -z-10 hidden dark:block"
        style={{
          background: "radial-gradient(circle at 50% 0%, #002A54 0%, #001a35 100%)"
        }}
      ></div>

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#002A54] hover:opacity-70 dark:text-blue-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>

      <div className="w-full max-w-2xl mt-12 md:mt-0">
        {/* ✅ Card: CUI Themed Colors */}
        <div className="bg-white dark:bg-[#001a35] rounded-3xl shadow-2xl border border-gray-200 dark:border-blue-900/50 overflow-hidden">
          
          <div className="px-6 md:px-8 pt-8 md:pt-10 pb-6 text-center border-b border-gray-100 dark:border-blue-900/30">
            <h1 className="text-3xl md:text-4xl font-bold text-[#002A54] dark:text-white mb-2">
              Profile Settings
            </h1>
            <p className="text-base text-gray-500 dark:text-blue-200/60">
              Manage your official CUI Connect information
            </p>
          </div>

          <div className="px-6 md:px-8 py-8 md:py-10">
            {successMessage && (
              <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-green-700 dark:text-green-300 font-bold text-center">{successMessage}</p>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  {/* Profile Avatar Container */}
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 dark:bg-[#002a54] p-1 shadow-lg ring-1 ring-gray-200 dark:ring-blue-800">
                    {previewImage || profileImage ? (
                      <img 
                        src={previewImage || profileImage || ""} 
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover bg-white dark:bg-[#001a35]"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gray-100 dark:bg-[#002a54] flex items-center justify-center">
                        <UserIcon className="w-12 h-12 text-gray-400 dark:text-blue-300/30" />
                      </div>
                    )}
                  </div>
                  {/* Upload Button: CUI Blue */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 rounded-full bg-[#002A54] dark:bg-blue-400 text-white dark:text-[#002A54] shadow-lg hover:scale-110 transition-transform"
                    aria-label="Upload new photo"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageUpload}
                  className="hidden"
                />
                
                <div className="text-center">
                  {errors.profileImage && (
                    <p className="text-sm text-red-600 mb-1">{errors.profileImage}</p>
                  )}
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-blue-300/40">
                    JPG or PNG (Max 5MB)
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-blue-900/30" />

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700 dark:text-blue-100 font-bold">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="py-6 bg-gray-50 dark:bg-[#002a54] border-gray-200 dark:border-blue-800 text-foreground focus:ring-2 focus:ring-[#002A54] dark:focus:ring-blue-400"
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700 dark:text-blue-100 font-bold">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="py-6 bg-gray-100 dark:bg-[#001a35] border-gray-200 dark:border-blue-900/50 text-gray-500 dark:text-blue-300/50 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password Section: Deep Navy Background */}
              <div className="space-y-4 p-6 rounded-2xl bg-gray-50 dark:bg-[#002a54]/40 border border-gray-200 dark:border-blue-900/50">
                <h3 className="font-bold text-[#002A54] dark:text-blue-100">Change Password</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword" dir="ltr" className="text-gray-700 dark:text-blue-200">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="bg-white dark:bg-[#001a35] border-gray-200 dark:border-blue-800"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" dir="ltr" className="text-gray-700 dark:text-blue-200">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="bg-white dark:bg-[#001a35] border-gray-200 dark:border-blue-800"
                  />
                  {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                {/* Primary Button: CUI Navy */}
                <Button
                  type="submit"
                  className="flex-1 py-6 text-base font-bold bg-[#002A54] hover:bg-[#003a75] text-white shadow-lg transition-all"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                
                {/* Logout Button: Outline CUI Blue */}
                <Button
                  type="button"
                  onClick={handleLogout}
                  variant="outline"
                  className="flex-1 py-6 text-base font-bold border-gray-200 dark:border-blue-800 text-gray-700 dark:text-blue-200 hover:bg-gray-100 dark:hover:bg-[#002a54] transition-colors"
                >
                  Sign Out
                </Button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}