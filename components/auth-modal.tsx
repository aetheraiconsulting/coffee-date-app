"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: "signin" | "signup"
}

export function AuthModal({ open, onOpenChange, defaultTab = "signin" }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">(defaultTab)
  
  // Sign in state
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")
  const [signInLoading, setSignInLoading] = useState(false)
  
  // Sign up state
  const [signUpName, setSignUpName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [signUpLoading, setSignUpLoading] = useState(false)
  
  const [googleLoading, setGoogleLoading] = useState(false)
  
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignInLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword,
      })

      if (error) throw error

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      })

      onOpenChange(false)
      router.push("/dashboard")
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      })
    } finally {
      setSignInLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignUpLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: signUpName,
          }
        }
      })

      if (error) throw error

      toast({
        title: "Success!",
        description: "Please check your email to confirm your account.",
      })

      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Signup Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      })
    } finally {
      setSignUpLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setGoogleLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      })

      if (error) throw error
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "Failed to authenticate with Google",
        variant: "destructive",
      })
      setGoogleLoading(false)
    }
  }

  const isLoading = signInLoading || signUpLoading || googleLoading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[420px] p-0 gap-0 border-0 bg-[#080B0F] overflow-hidden"
        style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        <DialogTitle className="sr-only">
          {activeTab === "signin" ? "Sign in to your account" : "Create an account"}
        </DialogTitle>
        
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-50 hover:opacity-100 transition-opacity z-10"
        >
          <X className="h-4 w-4 text-white" />
          <span className="sr-only">Close</span>
        </button>

        <div className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div 
              style={{ fontFamily: 'var(--font-manrope)' }} 
              className="font-extrabold text-lg tracking-tight text-white"
            >
              AETHER <span className="text-[#00AAFF]">AI</span> LAB
            </div>
          </div>

          {/* Tabs */}
          <div 
            className="flex rounded-lg p-1 mb-6"
            style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}
          >
            <button
              onClick={() => setActiveTab("signin")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                activeTab === "signin"
                  ? "bg-[#00AAFF] text-black"
                  : "text-white/50 hover:text-white/70"
              }`}
              disabled={isLoading}
            >
              Sign in
            </button>
            <button
              onClick={() => setActiveTab("signup")}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${
                activeTab === "signup"
                  ? "bg-[#00AAFF] text-black"
                  : "text-white/50 hover:text-white/70"
              }`}
              disabled={isLoading}
            >
              Create account
            </button>
          </div>

          {/* Sign In Form */}
          {activeTab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-sm font-medium text-white/70">
                  Email
                </Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-white/3 border-white/8 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password" className="text-sm font-medium text-white/70">
                    Password
                  </Label>
                  <button
                    type="button"
                    className="text-xs text-[#00AAFF] hover:text-[#00AAFF]/80 transition-colors"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="signin-password"
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-white/3 border-white/8 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#00AAFF] text-black hover:bg-[#00AAFF]/90 font-semibold"
                disabled={isLoading}
              >
                {signInLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-sm font-medium text-white/70">
                  Full Name
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="John Doe"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-white/3 border-white/8 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-sm font-medium text-white/70">
                  Email
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-white/3 border-white/8 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-sm font-medium text-white/70">
                  Password
                </Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 bg-white/3 border-white/8 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#00AAFF] text-black hover:bg-[#00AAFF]/90 font-semibold"
                disabled={isLoading}
              >
                {signUpLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2 text-white/30" style={{ background: '#080B0F' }}>
                Or continue with
              </span>
            </div>
          </div>

          {/* Google button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 bg-transparent hover:bg-white/5 text-white"
            style={{ border: '0.5px solid rgba(255,255,255,0.08)' }}
            onClick={handleGoogleAuth}
            disabled={isLoading}
          >
            {googleLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
