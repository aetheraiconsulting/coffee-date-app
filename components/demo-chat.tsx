"use client"

import { useRef, useEffect, useState } from "react"
import type React from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, RefreshCw, ArrowLeft, Link2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Android } from "@/lib/types"
import { DemoLinkProspectModal } from "@/components/demo-link-prospect-modal"

interface DemoChatProps {
  android: Android
  userId: string
  autoPresent?: boolean
}

function normalizeMessageText(message: any): string {
  if (!message) return ""
  if (typeof message.content === "string") return message.content
  if (Array.isArray(message.content))
    return message.content.map((p) => (typeof p === "string" ? p : p?.text || "")).join("")
  if (Array.isArray(message.parts))
    return message.parts.map((p) => (typeof p === "string" ? p : p?.text || "")).join("")
  if (typeof message.text === "string") return message.text
  return ""
}

function TypingIndicator() {
  return (
    <div className="flex justify-start px-4 animate-fade-in-up">
      <div className="bg-[#E5E5EA] rounded-2xl px-4 py-3 shadow-lg">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-zinc-500 animate-typing-dot" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-zinc-500 animate-typing-dot" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-zinc-500 animate-typing-dot" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  )
}

function extractFirstMessage(prompt: string, androidName: string, companyName: string, niche: string): string {
  const firstMessageMatch = prompt.match(/FIRST MESSAGE SENT:\s*\n(.*?)(?=\n\n|$)/s)
  if (firstMessageMatch && firstMessageMatch[1]) {
    return firstMessageMatch[1].trim()
  }

  return `It's ${androidName} from ${companyName} here. Is this the same person that got a ${niche} quote from us in the last couple of months?`
}

const aiBubble = {
  backgroundColor: "#E5E5EA",
  color: "#000000",
  borderRadius: 18,
  padding: "12px 16px",
  maxWidth: "80%",
  margin: "6px 0",
  whiteSpace: "pre-wrap" as const,
  lineHeight: 1.45,
  fontSize: "15px",
  fontWeight: 500,
  opacity: 1,
  mixBlendMode: "normal" as const,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const userBubble = {
  backgroundColor: "#089FEF",
  color: "#FFFFFF",
  borderRadius: 18,
  padding: "12px 16px",
  maxWidth: "80%",
  margin: "6px 0",
  whiteSpace: "pre-wrap" as const,
  lineHeight: 1.45,
  fontSize: "15px",
  fontWeight: 500,
  opacity: 1,
  mixBlendMode: "normal" as const,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

export default function DemoChat({ android, userId, autoPresent = false }: DemoChatProps) {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [isBooting, setIsBooting] = useState(true)
  const [showLogo, setShowLogo] = useState(true)
  const [showPhone, setShowPhone] = useState(false)
  const [showFirstMessage, setShowFirstMessage] = useState(false)
  const [showTypingForFirst, setShowTypingForFirst] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [presentationMode, setPresentationMode] = useState(autoPresent)
  // Demo owner can attribute this session to a specific prospect. Controlled
  // from the header's "Link prospect" button.
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linkedProspectId, setLinkedProspectId] = useState<string | null>(null)

  const companyName = android.business_context?.company_name || android.business_context?.businessName || "My Business"
  const niche = android.business_context?.niche || android.business_context?.industry || "services"

  const firstAIMessage = extractFirstMessage(android.prompt || "", android.name, companyName, niche)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/chat?androidId=${android.id}`,
    }),
    onError: (error) => {
      console.error("[v0] Chat error:", error)
    },
    onResponse: (response) => {
      console.log("[v0] Chat response received:", response.status)
    },
    onFinish: (message) => {
      console.log("[v0] Chat finished:", message)
    },
  })

  const isLoading = status === "in_progress"

  useEffect(() => {
    console.log("[v0] Chat status:", status)
    console.log("[v0] Messages count:", messages.length)
    if (error) {
      console.error("[v0] Chat error state:", error)
    }
  }, [status, messages, error])

  useEffect(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      setIsBooting(false)
      setShowLogo(false)
      setShowPhone(true)
      setTimeout(() => {
        setShowTypingForFirst(true)
        setTimeout(() => {
          setShowTypingForFirst(false)
          setShowFirstMessage(true)
        }, 2000)
      }, 500)
      return
    }

    const logoTimer = setTimeout(() => {
      setShowLogo(false)
      setShowPhone(true)
    }, 2000)

    const bootTimer = setTimeout(() => {
      setIsBooting(false)
      setShowTypingForFirst(true)
      setTimeout(() => {
        setShowTypingForFirst(false)
        setShowFirstMessage(true)
      }, 2000)
    }, 2800)

    return () => {
      clearTimeout(logoTimer)
      clearTimeout(bootTimer)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, showTypingForFirst, showFirstMessage])

  useEffect(() => {
    const checkStyles = () => {
      const messageEl = document.querySelector(".chat-message")
      if (messageEl) {
        const computed = window.getComputedStyle(messageEl)
        console.log("[v0] Message computed styles:", {
          color: computed.color,
          opacity: computed.opacity,
          mixBlendMode: computed.mixBlendMode,
          backgroundColor: computed.backgroundColor,
        })
      }
    }
    setTimeout(checkStyles, 3000)
  }, [])

  // Escape key to exit presentation mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && presentationMode) {
        setPresentationMode(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [presentationMode])

  // Hide sidebar and header when in presentation mode
  useEffect(() => {
    const sidebar = document.querySelector('aside') || 
                    document.querySelector('[data-sidebar]') ||
                    document.querySelector('nav')
    
    const header = document.querySelector('header')

    if (presentationMode) {
      if (sidebar) (sidebar as HTMLElement).style.display = 'none'
      if (header) (header as HTMLElement).style.display = 'none'
    } else {
      if (sidebar) (sidebar as HTMLElement).style.display = ''
      if (header) (header as HTMLElement).style.display = ''
    }

    return () => {
      if (sidebar) (sidebar as HTMLElement).style.display = ''
      if (header) (header as HTMLElement).style.display = ''
    }
  }, [presentationMode])

  // Prevent body scrolling when in presentation mode
  useEffect(() => {
    if (presentationMode) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [presentationMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    console.log("[v0] Sending message:", input.trim())
    sendMessage({ text: input.trim() })
    setInput("")
  }

  const handleNewChat = () => {
    window.location.reload()
  }

  const handleBack = () => {
    router.push("/demo")
  }

  // Presentation mode - full screen overlay
  if (presentationMode) {
    return (
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: '#080B0F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Exit button — top right corner, subtle */}
        <button
          onClick={() => setPresentationMode(false)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            background: 'transparent',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Exit presentation
        </button>

        {/* Phone mockup centred */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '32px' }}>
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "40px",
              backgroundColor: isDarkMode ? "#000000" : "#F4F4F6",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 25px rgba(8,159,239,0.2)",
              height: "85vh",
              maxHeight: "800px",
              width: "100%",
              maxWidth: "420px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Minimal header for presentation */}
            <header
              className="flex-shrink-0 border-b px-4 py-3"
              style={{
                background: isDarkMode
                  ? "linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)"
                  : "linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold" style={{ color: isDarkMode ? "#ffffff" : "#000000" }}>
                    {android.name}
                  </h1>
                  <p className="text-xs" style={{ color: isDarkMode ? "#999999" : "#666666" }}>
                    {companyName}
                  </p>
                </div>
                <Button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  style={{ color: isDarkMode ? "#ffffff" : "#333333" }}
                >
                  {isDarkMode ? "☀️" : "🌙"}
                </Button>
              </div>
            </header>

            {/* Chat messages */}
            <div
              className="flex-1 overflow-y-auto px-4 py-6 space-y-4 chat-window"
              style={{
                backgroundColor: "#FFFFFF",
                color: "#000000",
                padding: "20px",
                overflowY: "auto",
                height: "100%",
                isolation: "isolate",
                filter: "none",
                boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.06)",
              }}
            >
              {showTypingForFirst && <TypingIndicator />}

              {showFirstMessage && (
                <div
                  className="animate-message-slide-in chat-message"
                  data-role="assistant"
                  style={{
                    ...aiBubble,
                    alignSelf: "flex-start",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  <span style={{ color: "#000000", opacity: 1, mixBlendMode: "normal" }}>
                    {firstAIMessage}
                  </span>
                </div>
              )}

              {messages.map((m, i) => {
                const text = normalizeMessageText(m)
                if (!text) return null
                const isUser = m.role === "user"
                return (
                  <div
                    key={i}
                    className="animate-message-slide-in chat-message"
                    data-role={isUser ? "user" : "assistant"}
                    style={{
                      ...(isUser ? userBubble : aiBubble),
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      animationDelay: `${i * 100}ms`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  >
                    <span style={{ color: isUser ? "#FFFFFF" : "#000000", opacity: 1, mixBlendMode: "normal" }}>
                      {text}
                    </span>
                  </div>
                )
              })}

              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              className="flex-shrink-0 border-t px-4 py-3"
              style={{
                background: isDarkMode
                  ? "linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%)"
                  : "linear-gradient(180deg, #F5F5F5 0%, #FAFAFA 100%)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                borderBottomLeftRadius: "40px",
                borderBottomRightRadius: "40px",
                padding: "12px 16px",
              }}
            >
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={showFirstMessage ? "Type as the prospect…" : "Waiting for Android..."}
                  disabled={isLoading || !showFirstMessage}
                  autoComplete="off"
                  className="rounded-full h-11 px-4 transition-all duration-300 disabled:opacity-50"
                  style={{
                    backgroundColor: isDarkMode ? "#1a1a1a" : "#FFFFFF",
                    borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    color: isDarkMode ? "#ffffff" : "#000000",
                  }}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim() || !showFirstMessage}
                  size="icon"
                  className="bg-aether text-white hover:bg-aether/90 hover:shadow-[0_0_20px_rgba(8,159,239,0.5)] hover:scale-105 rounded-full h-11 w-11 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: isDarkMode
          ? "linear-gradient(180deg, #000000 0%, #020a12 100%)"
          : "radial-gradient(circle at center, #F8F8F8 0%, #EDEDED 100%)",
      }}
    >
      <div
        className="absolute inset-0 animate-breathing-glow"
        style={{
          background: isDarkMode
            ? "radial-gradient(circle at center, rgba(8,159,239,0.15) 0%, transparent 70%)"
            : "radial-gradient(circle at center, rgba(8,159,239,0.08) 0%, transparent 70%)",
        }}
      />

      {showLogo && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-aether opacity-40 animate-pulse-slow" />
            <h1 className="relative text-5xl font-bold text-white tracking-tight">
              RE:VIVE <span className="text-aether">by Aether</span>
            </h1>
          </div>
          <p className="mt-6 text-white/70 text-lg animate-typewriter overflow-hidden whitespace-nowrap border-r-2 border-aether">
            Initializing Android...
          </p>
          <div className="flex gap-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-aether animate-pulse" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-aether animate-pulse" style={{ animationDelay: "200ms" }} />
            <div className="w-2 h-2 rounded-full bg-aether animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
        </div>
      )}

      {showPhone && (
        <div
          className={`relative z-10 w-full mx-4 md:mx-auto ${isBooting ? "animate-phone-scale-in" : ""}`}
          style={{
            maxWidth: "420px",
            padding: "16px",
            margin: "auto",
          }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "40px",
              backgroundColor: isDarkMode ? "#000000" : "#F4F4F6",
              boxShadow: isDarkMode
                ? "0 10px 30px rgba(0,0,0,0.5), 0 0 25px rgba(8,159,239,0.2)"
                : "0 10px 30px rgba(0,0,0,0.25)",
              height: "90vh",
              maxHeight: "800px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontSize: "11px",
                color: isDarkMode ? "#999" : "#666",
                padding: "8px 0",
                backgroundColor: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                borderBottom: `1px solid ${isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
              }}
            >
              ☕ Coffee Date Demo Mode — powered by Aether AI
            </div>

            <header
              className="flex-shrink-0 border-b px-4 py-4"
              style={{
                background: isDarkMode
                  ? "linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)"
                  : "linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleBack}
                    size="icon"
                    variant="ghost"
                    className="transition-all duration-300 h-8 w-8"
                    style={{
                      color: isDarkMode ? "#ffffff" : "#333333",
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-lg font-semibold" style={{ color: isDarkMode ? "#ffffff" : "#000000" }}>
                      {android.name} — {companyName}
                    </h1>
                    <p className="text-xs" style={{ color: isDarkMode ? "#999999" : "#666666" }}>
                      Coffee Date Demo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLinkModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-white/10 hover:border-white/20 rounded-lg transition-colors"
                    style={{
                      color: linkedProspectId
                        ? "#00AAFF"
                        : isDarkMode
                          ? "rgba(255,255,255,0.5)"
                          : "rgba(0,0,0,0.5)",
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {linkedProspectId ? "Prospect linked" : "Link prospect"}
                  </button>
                  <button
                    onClick={() => setPresentationMode(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
                    style={{ color: isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="2" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5 11v1.5M9 11v1.5M3.5 12.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Present
                  </button>
                  <Button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    style={{ color: isDarkMode ? "#ffffff" : "#333333" }}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </Button>
                  <Button
                    onClick={handleNewChat}
                    size="sm"
                    variant="ghost"
                    className="text-aether hover:bg-aether/10 hover:text-aether transition-all duration-300"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    New Chat
                  </Button>
                </div>
              </div>
            </header>

            <div
              className="flex-1 overflow-y-auto px-4 py-6 space-y-4 chat-window"
              style={{
                backgroundColor: "#FFFFFF",
                color: "#000000",
                padding: "20px",
                overflowY: "auto",
                height: "100%",
                isolation: "isolate",
                filter: "none",
                boxShadow: "inset 0 -2px 4px rgba(0,0,0,0.06)",
              }}
            >
              {showTypingForFirst && <TypingIndicator />}

              {showFirstMessage && (
                <div
                  className="animate-message-slide-in chat-message"
                  data-role="assistant"
                  style={{
                    ...aiBubble,
                    alignSelf: "flex-start",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  <span
                    style={{
                      color: "#000000",
                      opacity: 1,
                      mixBlendMode: "normal",
                    }}
                  >
                    {firstAIMessage}
                  </span>
                </div>
              )}

              {messages.map((m, i) => {
                const text = normalizeMessageText(m)
                if (!text) return null
                const isUser = m.role === "user"
                return (
                  <div
                    key={i}
                    className="animate-message-slide-in chat-message"
                    data-role={isUser ? "user" : "assistant"}
                    style={{
                      ...(isUser ? userBubble : aiBubble),
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      animationDelay: `${i * 100}ms`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  >
                    <span
                      style={{
                        color: isUser ? "#FFFFFF" : "#000000",
                        opacity: 1,
                        mixBlendMode: "normal",
                      }}
                    >
                      {text}
                    </span>
                  </div>
                )
              })}

              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            <div
              className="flex-shrink-0 border-t px-4 py-3"
              style={{
                background: isDarkMode
                  ? "linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%)"
                  : "linear-gradient(180deg, #F5F5F5 0%, #FAFAFA 100%)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                borderBottomLeftRadius: "40px",
                borderBottomRightRadius: "40px",
                padding: "12px 16px",
              }}
            >
              <form onSubmit={handleSubmit} className="flex gap-2 mb-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={showFirstMessage ? "Type as the prospect…" : "Waiting for Android..."}
                  disabled={isLoading || !showFirstMessage}
                  autoComplete="off"
                  className="rounded-full h-11 px-4 transition-all duration-300 disabled:opacity-50"
                  style={{
                    backgroundColor: isDarkMode ? "#1a1a1a" : "#FFFFFF",
                    borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    color: isDarkMode ? "#ffffff" : "#000000",
                  }}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim() || !showFirstMessage}
                  size="icon"
                  className="bg-aether text-white hover:bg-aether/90 hover:shadow-[0_0_20px_rgba(8,159,239,0.5)] hover:scale-105 rounded-full h-11 w-11 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <p className="text-[10px] text-center" style={{ color: isDarkMode ? "#666666" : "#999999" }}>
                Powered by RE:VIVE Chat System • Built with Aether AI
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Prospect-linking modal. Rendered at the root so it overlays both
          the regular and presentation-mode views without being unmounted
          when toggling between them. */}
      <DemoLinkProspectModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        userId={userId}
        androidId={android.id}
        onLinked={(id) => setLinkedProspectId(id)}
      />
    </div>
  )
}
