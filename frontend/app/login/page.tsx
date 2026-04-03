"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { login } from "@/lib/api"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await login(email, password)
      
      localStorage.setItem("accessToken", response.access_token)
      localStorage.setItem("refreshToken", response.refresh_token)
      localStorage.setItem("tokenType", response.token_type)
      localStorage.setItem("user", JSON.stringify(response.user))
      localStorage.setItem("authSession", JSON.stringify({ 
        email, 
        authenticated: true, 
        timestamp: Date.now() 
      }))
      
      router.push("/")
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Login failed"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // Outer Container: Using bg-black for dark mode to ensure a clean contrast
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative bg-gray-50 dark:bg-black transition-colors">
      
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* ✅ THE FIX: 
          Instead of bg-white, we use bg-white in light and a specific hex for dark 
          to ensure it never goes invisible.
        */}
        <div className="bg-white dark:bg-[#001a35] rounded-3xl shadow-2xl border border-gray-200 dark:border-blue-900/50 overflow-hidden">
          
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-gray-100 dark:border-blue-900/30">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-500 dark:text-blue-200/60">
              Sign in to your account to continue
            </p>
          </div>

          <div className="px-8 pb-10 pt-6">
            {error && (
              <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 text-sm text-center font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 dark:text-blue-100">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  // Inputs: Forced dark background to prevent light blue clash
                  className="bg-gray-50 dark:bg-[#002a54] border-gray-200 dark:border-blue-800 text-gray-900 dark:text-white focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" dir="ltr" className="text-gray-700 dark:text-blue-100">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-gray-50 dark:bg-[#002a54] border-gray-200 dark:border-blue-800 text-gray-900 dark:text-white focus:ring-blue-500"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full py-6 font-bold bg-[#002A54] hover:bg-[#003a75] text-white rounded-xl transition-all shadow-lg"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600 dark:text-blue-200/50">
                Don't have an account?{" "}
                <Link href="/signup" className="font-bold text-[#002A54] dark:text-blue-400 hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}