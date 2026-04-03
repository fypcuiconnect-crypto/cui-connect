"use client"

import type React from "react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { signup } from "@/lib/api"
import { CheckCircle2, ShieldCheck, ShieldAlert, Check, X } from "lucide-react"

export default function SignupPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isSuccess, setIsSuccess] = useState(false) 

  // ✅ Advanced Password Validation Logic
  const requirements = useMemo(() => [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains Uppercase & Lowercase", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "Contains a Number", met: /[0-9]/.test(password) },
    { label: "Contains Special Character (@$!%*?&)", met: /[^A-Za-z0-9]/.test(password) },
  ], [password])

  const strengthScore = requirements.filter(r => r.met).length

  const getStrengthUI = () => {
    if (strengthScore === 0) return { label: "Very Weak", color: "bg-gray-300", text: "text-gray-500" }
    if (strengthScore <= 2) return { label: "Weak", color: "bg-red-500", text: "text-red-500" }
    if (strengthScore === 3) return { label: "Fair", color: "bg-yellow-500", text: "text-yellow-500" }
    return { label: "Strong", color: "bg-green-500", text: "text-green-500" }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    // Final Validation Check
    if (strengthScore < 4) {
      setError("Please fulfill all password requirements.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    
    setIsLoading(true)
    try {
      await signup(fullName, email, password)
      setIsSuccess(true)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create account"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative bg-gray-50 dark:bg-black transition-colors">
      <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#001a35] rounded-3xl shadow-2xl border border-gray-200 dark:border-blue-900/50 overflow-hidden">
          
          {isSuccess ? (
             <div className="px-8 py-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6 border border-green-200">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Account Created!</h2>
                <p className="text-gray-600 dark:text-blue-200/70 mb-8">Verification link sent to <b>{email}</b>.</p>
                <Link href="/login" className="w-full">
                  <Button className="w-full py-6 font-bold bg-[#002A54] text-white rounded-xl">Go to Login</Button>
                </Link>
             </div>
          ) : (
            <>
              <div className="px-8 pt-10 pb-6 text-center border-b border-gray-100 dark:border-blue-900/30">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create Account</h1>
                <p className="text-gray-500 dark:text-blue-200/60">Official CUI Connect Registration</p>
              </div>

              <div className="px-8 pb-10 pt-6">
                {error && <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 text-sm text-center font-medium rounded-lg">{error}</div>}

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="dark:text-blue-100">Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-gray-50 dark:bg-[#002a54] dark:text-white dark:border-blue-800" required />
                  </div>

                  <div className="space-y-1">
                    <Label className="dark:text-blue-100">Email Address</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-gray-50 dark:bg-[#002a54] dark:text-white dark:border-blue-800" required />
                  </div>

                  {/* Password + Strength Checklist */}
                  <div className="space-y-1">
                    <Label className="dark:text-blue-100">Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-gray-50 dark:bg-[#002a54] dark:text-white dark:border-blue-800" required />
                    
                    {/* Visual Strength Bar */}
                    <div className="h-1.5 w-full bg-gray-200 dark:bg-blue-900/40 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${getStrengthUI().color}`} style={{ width: `${(strengthScore / 4) * 100}%` }} />
                    </div>

                    {/* Requirements Checklist */}
                    <div className="grid grid-cols-1 gap-1.5 pt-3">
                      {requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {req.met ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-gray-400" />}
                          <span className={`text-xs font-medium ${req.met ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-blue-200/40"}`}>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="dark:text-blue-100">Confirm Password</Label>
                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-gray-50 dark:bg-[#002a54] dark:text-white dark:border-blue-800" required />
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-6 mt-4 font-bold bg-[#002A54] hover:bg-[#003a75] text-white rounded-xl shadow-lg disabled:opacity-50"
                    disabled={isLoading || strengthScore < 4}
                  >
                    {isLoading ? "Processing..." : "Sign Up"}
                  </Button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-600 dark:text-blue-200/50">Already have an account? <Link href="/login" className="font-bold text-[#002A54] dark:text-blue-400 hover:underline">Sign in</Link></p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}