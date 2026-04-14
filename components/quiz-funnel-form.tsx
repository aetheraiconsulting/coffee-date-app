"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { ChevronRight, ChevronLeft, Loader2, Sparkles, Calendar, Mic, MicOff } from "lucide-react"
import Image from "next/image"

interface QuizQuestion {
  id: string
  question: string
  options: { label: string; value: number }[]
}

interface Branding {
  logo_url?: string
  company_name?: string
  brand_colour?: string
  calendar_link?: string
}

interface QuizFunnelFormProps {
  code?: string
  subdomain?: string
}

export default function QuizFunnelForm({ code, subdomain }: QuizFunnelFormProps) {
  const [step, setStep] = useState<"loading" | "error" | "hero" | "contact" | "questions" | "calculating" | "results">("loading")
  const [userId, setUserId] = useState<string | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [quizTitle, setQuizTitle] = useState("AI Readiness Quiz")
  const [quizDescription, setQuizDescription] = useState("Discover your AI readiness score in under 3 minutes")
  const [ctaText, setCtaText] = useState("Book Your AI Readiness Audit")
  const [ctaUrl, setCtaUrl] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Form state
  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  
  // Results state
  const [score, setScore] = useState(0)
  const [scoreTier, setScoreTier] = useState<"High" | "Medium" | "Low">("Medium")
  const [resultsMessage, setResultsMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  
  // Voice state
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const accentColor = branding?.brand_colour || "#00AAFF"

  // Check voice support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (SpeechRecognition) setVoiceSupported(true)
  }, [])

  // Fetch quiz data on mount
  useEffect(() => {
    async function fetchQuizData() {
      try {
        const params = new URLSearchParams()
        if (code) params.set("code", code)
        if (subdomain) params.set("subdomain", subdomain)

        const response = await fetch(`/api/quiz/public?${params}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Quiz not found")
        }

        const data = await response.json()
        setUserId(data.user_id)
        setBranding(data.branding || null)
        setQuestions(data.questions || [])
        setQuizTitle(data.title || "AI Readiness Quiz")
        setQuizDescription(data.description || "Discover your AI readiness score in under 3 minutes")
        setCtaText(data.cta_text || "Book Your AI Readiness Audit")
        setCtaUrl(data.cta_url || data.branding?.calendar_link || "")
        setStep("hero")
        
        // Track view
        if (data.quiz_id) {
          fetch("/api/quiz/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizTemplateId: data.quiz_id, event: "view" })
          }).catch(() => {})
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Quiz not found")
        setStep("error")
      }
    }

    fetchQuizData()
  }, [code, subdomain])

  // Voice toggle
  function toggleVoice(fieldId: string, setter: (val: string) => void, currentValue: string) {
    const SpeechRecognition = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (activeVoiceField === fieldId && recognitionRef.current) {
      recognitionRef.current.stop()
      setActiveVoiceField(null)
      return
    }

    if (recognitionRef.current) recognitionRef.current.stop()

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      setter(currentValue + transcript)
    }

    recognition.onerror = () => {
      setActiveVoiceField(null)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setActiveVoiceField(null)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
    setActiveVoiceField(fieldId)
  }

  // Handle quiz start
  function handleStart() {
    setStep("contact")
  }

  // Handle contact form submit
  function handleContactSubmit() {
    if (!firstName.trim() || !email.trim() || !companyName.trim()) return
    setCurrentQuestion(0)
    setStep("questions")
  }

  // Handle answer selection
  function selectAnswer(questionId: string, value: number) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    
    // Auto-advance after short delay
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(prev => prev + 1)
      } else {
        handleSubmit()
      }
    }, 300)
  }

  // Handle submit
  async function handleSubmit() {
    setStep("calculating")
    setSubmitting(true)

    try {
      const response = await fetch("/api/quiz/submit-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          code,
          subdomain,
          contact: { firstName, email, companyName },
          answers
        })
      })

      if (!response.ok) throw new Error("Submission failed")

      const data = await response.json()
      setScore(data.score)
      setScoreTier(data.tier)
      setResultsMessage(data.message || getDefaultMessage(data.tier))
      
      // Brief delay to show calculating animation
      setTimeout(() => {
        setStep("results")
      }, 2000)
    } catch (error) {
      console.error("Submit error:", error)
      setStep("results")
      setScore(50)
      setScoreTier("Medium")
      setResultsMessage(getDefaultMessage("Medium"))
    } finally {
      setSubmitting(false)
    }
  }

  function getDefaultMessage(tier: string): string {
    switch (tier) {
      case "High":
        return "You're ahead of the curve — your systems and mindset are primed for AI. Let's discuss advanced implementations."
      case "Medium":
        return "You're experimenting but missing efficiency gains. We'll show you where to focus for maximum impact."
      default:
        return "You're missing out on AI's advantages. The audit will show where to start for maximum impact."
    }
  }

  const progress = step === "contact" 
    ? 0 
    : step === "questions" 
      ? ((currentQuestion + 1) / questions.length) * 100 
      : 100

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#080B0F" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  // Error state
  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#080B0F" }}>
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Quiz not found</h2>
          <p className="text-white/50 text-sm">{errorMessage}</p>
        </div>
      </div>
    )
  }

  // Hero state
  if (step === "hero") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#080B0F" }}>
        <div className="max-w-lg w-full text-center">
          {branding?.logo_url && (
            <div className="mb-8">
              <Image
                src={branding.logo_url}
                alt={branding.company_name || "Logo"}
                width={120}
                height={40}
                className="mx-auto object-contain"
              />
            </div>
          )}
          
          <div className="mb-6">
            <Sparkles className="h-12 w-12 mx-auto mb-4" style={{ color: accentColor }} />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {quizTitle}
          </h1>
          <p className="text-white/60 text-lg mb-8">
            {quizDescription}
          </p>
          
          <Button
            onClick={handleStart}
            className="text-lg px-8 py-6 rounded-xl text-white shadow-lg"
            style={{ backgroundColor: accentColor }}
          >
            Start Quiz
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
          
          <p className="text-white/30 text-sm mt-6">
            Takes less than 3 minutes
          </p>
        </div>
      </div>
    )
  }

  // Contact form
  if (step === "contact") {
    return (
      <div className="min-h-screen flex flex-col p-6" style={{ background: "#080B0F" }}>
        {/* Progress bar */}
        <div className="w-full max-w-lg mx-auto mb-8">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{ width: "5%", backgroundColor: accentColor }}
            />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-lg bg-white/[0.02] border-white/10 p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Let&apos;s get started</h2>
            <p className="text-white/50 mb-6">Tell us a bit about yourself</p>
            
            <div className="space-y-4">
              <div>
                <Label className="text-white/70 text-sm">First Name</Label>
                <div className="relative">
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
                    placeholder="John"
                  />
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={() => toggleVoice("firstName", setFirstName, firstName)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded ${
                        activeVoiceField === "firstName"
                          ? "bg-red-500/20 text-red-400 animate-pulse"
                          : "text-white/30 hover:text-white/60"
                      }`}
                    >
                      {activeVoiceField === "firstName" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-white/70 text-sm">Email</Label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
                    placeholder="john@company.com"
                  />
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={() => toggleVoice("email", setEmail, email)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded ${
                        activeVoiceField === "email"
                          ? "bg-red-500/20 text-red-400 animate-pulse"
                          : "text-white/30 hover:text-white/60"
                      }`}
                    >
                      {activeVoiceField === "email" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-white/70 text-sm">Company Name</Label>
                <div className="relative">
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pr-10"
                    placeholder="Acme Inc"
                  />
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={() => toggleVoice("company", setCompanyName, companyName)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded ${
                        activeVoiceField === "company"
                          ? "bg-red-500/20 text-red-400 animate-pulse"
                          : "text-white/30 hover:text-white/60"
                      }`}
                    >
                      {activeVoiceField === "company" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <Button
              onClick={handleContactSubmit}
              disabled={!firstName.trim() || !email.trim() || !companyName.trim()}
              className="w-full mt-6 text-white"
              style={{ backgroundColor: accentColor }}
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  // Questions
  if (step === "questions") {
    const question = questions[currentQuestion]
    
    return (
      <div className="min-h-screen flex flex-col p-6" style={{ background: "#080B0F" }}>
        {/* Progress bar */}
        <div className="w-full max-w-lg mx-auto mb-4">
          <div className="flex justify-between text-white/40 text-sm mb-2">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg">
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-8 text-center">
              {question?.question}
            </h2>
            
            <div className="space-y-3">
              {question?.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => selectAnswer(question.id, option.value)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    answers[question.id] === option.value
                      ? "border-2 bg-white/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                  }`}
                  style={answers[question.id] === option.value ? { borderColor: accentColor } : {}}
                >
                  <span className="text-white">{option.label}</span>
                </button>
              ))}
            </div>
            
            {currentQuestion > 0 && (
              <button
                onClick={() => setCurrentQuestion(prev => prev - 1)}
                className="flex items-center text-white/40 hover:text-white/60 mt-6 mx-auto"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Calculating
  if (step === "calculating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#080B0F" }}>
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div 
              className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: `${accentColor}33`, borderTopColor: accentColor }}
            />
            <Sparkles className="absolute inset-0 m-auto h-10 w-10" style={{ color: accentColor }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Analyzing your responses...</h2>
          <p className="text-white/50">Generating your personalized AI readiness score</p>
        </div>
      </div>
    )
  }

  // Results
  if (step === "results") {
    const tierColors = {
      High: "#22c55e",
      Medium: "#f59e0b", 
      Low: "#ef4444"
    }
    const tierColor = tierColors[scoreTier]

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#080B0F" }}>
        <div className="max-w-lg w-full text-center">
          {branding?.logo_url && (
            <div className="mb-6">
              <Image
                src={branding.logo_url}
                alt={branding.company_name || "Logo"}
                width={100}
                height={32}
                className="mx-auto object-contain"
              />
            </div>
          )}
          
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{ backgroundColor: `${tierColor}20`, color: tierColor }}
          >
            <Sparkles className="h-4 w-4" />
            {scoreTier} AI Readiness
          </div>
          
          <div className="mb-6">
            <div 
              className="text-7xl md:text-8xl font-bold mb-2"
              style={{ color: tierColor }}
            >
              {score}
            </div>
            <div className="text-white/40 text-lg">out of 100</div>
          </div>
          
          <p className="text-white/70 text-lg mb-8 leading-relaxed">
            {resultsMessage}
          </p>
          
          {ctaUrl && (
            <Button
              asChild
              className="text-lg px-8 py-6 rounded-xl text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer">
                <Calendar className="mr-2 h-5 w-5" />
                {ctaText}
              </a>
            </Button>
          )}
          
          <p className="text-white/30 text-sm mt-6">
            Your results have been saved. We&apos;ll be in touch!
          </p>
        </div>
      </div>
    )
  }

  return null
}
