"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      })

      router.push("/dashboard")
      router.refresh()
    } catch (error: any) {
      const message = error?.message || "Invalid email or password"
      setErrorMessage(message)
      toast({
        title: "Authentication Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
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
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      })
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080B0F] flex">
      {/* Subtle radial blue glow - positioned for split layout */}
      <div 
        className="fixed top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.08] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, #00AAFF 0%, transparent 70%)',
        }}
      />

      {/* LEFT SIDE - Brand Panel */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 xl:p-16">
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-20">
            <Image 
              src="/images/aether-revive-logo.png" 
              alt="Aether Revive" 
              width={120} 
              height={120}
              className="opacity-90"
            />
          </div>

          {/* Main message */}
          <div className="max-w-md">
            <h1 
              className="text-[42px] xl:text-[48px] text-white mb-6 leading-[1.1]"
              style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
            >
              Revive conversations.{' '}
              <span className="text-[#00AAFF]">Reignite leads.</span>
            </h1>
            <p 
              className="text-base xl:text-lg leading-relaxed mb-4"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              Access your AI-powered agency workspace and continue building your client pipeline.
            </p>
            <p 
              className="text-sm"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              Pick up where you left off.
            </p>
          </div>
        </div>

        {/* Bottom badge */}
        <div className="relative z-10">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '0.5px solid rgba(255,255,255,0.08)' 
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#00AAFF]" />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
              AI Client Acquisition System
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 md:p-12">
        <div 
          className="w-full max-w-[420px] rounded-xl p-8 md:p-10"
          style={{ 
            background: 'rgba(255,255,255,0.03)', 
            border: '0.5px solid rgba(255,255,255,0.06)' 
          }}
        >
          {/* Mobile Logo - only visible on mobile */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <Image 
              src="/images/aether-revive-logo.png" 
              alt="Aether Revive" 
              width={100} 
              height={100}
              className="opacity-90"
            />
          </div>

          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h2 
                className="text-[24px] text-white"
                style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
              >
                Welcome back
              </h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Sign in to continue building your AI agency
              </p>
            </div>

            {/* Inline error */}
            {errorMessage && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#00AAFF]/50 focus:ring-[#00AAFF]/20 rounded-lg"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-white">Password</Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-xs text-[#00AAFF] hover:text-[#00AAFF]/80 transition-colors"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading || googleLoading}
                  className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30 focus:border-[#00AAFF]/50 focus:ring-[#00AAFF]/20 rounded-lg"
                  autoComplete="current-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-[#00AAFF] text-black hover:bg-[#00AAFF]/90 font-medium rounded-lg"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4" style={{ color: 'rgba(255,255,255,0.3)', background: '#080B0F' }}>
                  or
                </span>
              </div>
            </div>

            {/* Google Button */}
            <Button 
              type="button"
              variant="outline"
              className="w-full h-12 bg-white/[0.03] border-white/[0.08] text-white hover:bg-white/[0.06] hover:border-white/[0.12] rounded-lg"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
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

            {/* Footer */}
            <div className="text-center text-sm pt-2">
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>{"Don't have an account? "}</span>
              <Link 
                href="/signup" 
                className="text-[#00AAFF] hover:text-[#00AAFF]/80 font-medium transition-colors"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
