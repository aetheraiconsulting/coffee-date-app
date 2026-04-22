"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react"

interface QuizOption {
  text: string
  value: number
}

interface QuizQuestion {
  id: string
  text: string
  type: string
  options?: QuizOption[]
}

interface QuizTemplate {
  id: string
  title: string
  description: string
  questions: QuizQuestion[]
  brand_color: string
  logo_url: string | null
  cta_text: string
  cta_url: string
}

const SCORING_MESSAGES = {
  high: {
    title: "High AI Readiness",
    message: "You're ahead of the curve — your systems and mindset are primed for AI.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  medium: {
    title: "Medium AI Readiness",
    message: "You're experimenting but missing efficiency gains. We'll show you where to focus.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  low: {
    title: "Low AI Readiness",
    message: "You're missing out on AI's advantages. The audit will show where to start for maximum impact.",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
}

export default function QuizFunnelPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [quiz, setQuiz] = useState<QuizTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0) // 0 = hero, 1 = contact, 2+ = questions
  const [contactInfo, setContactInfo] = useState({ firstName: "", email: "", companyName: "" })
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  const supabase = createClient()

  useEffect(() => {
    loadQuiz()
  }, [quizId])

  const loadQuiz = async () => {
    try {
      const { data, error } = await supabase.from("quiz_templates").select("*").eq("id", quizId).single()

      if (error) throw error
      setQuiz(data)

      // Track view
      fetch("/api/quiz/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, event: "view" }),
      }).catch(() => {})
    } catch (error) {
      console.error("Error loading quiz:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const startQuiz = () => {
    setCurrentStep(1)
    // Track start
    fetch("/api/quiz/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, event: "start" }),
    }).catch(() => {})
  }

  const handleContactSubmit = () => {
    if (!contactInfo.firstName || !contactInfo.email || !contactInfo.companyName) return
    setCurrentStep(2)
  }

  const handleAnswerSelect = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const nextQuestion = () => {
    if (!quiz) return
    const totalSteps = quiz.questions.length + 2 // hero + contact + questions
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      submitQuiz()
    }
  }

  const prevQuestion = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const submitQuiz = async () => {
    if (!quiz) return
    setIsSubmitting(true)

    const score = Object.values(answers).reduce((sum, val) => sum + val, 0)
    const maxScore = quiz.questions.length * 10
    const normalizedScore = Math.round((score / maxScore) * 100)

    try {
      await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizTemplateId: quizId,
          contactInfo,
          answers,
          score: normalizedScore,
        }),
      })

      setFinalScore(normalizedScore)
      setShowResults(true)
    } catch (error) {
      console.error("Submit error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getScoreTier = () => {
    if (finalScore >= 80) return SCORING_MESSAGES.high
    if (finalScore >= 40) return SCORING_MESSAGES.medium
    return SCORING_MESSAGES.low
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">Quiz not found</p>
      </div>
    )
  }

  const brandColor = quiz.brand_color || "#089fef"
  const totalSteps = quiz.questions.length + 2
  const progress = currentStep === 0 ? 0 : ((currentStep - 1) / (totalSteps - 2)) * 100

  // Results screen
  if (showResults) {
    const tier = getScoreTier()
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          {quiz.logo_url && <img src={quiz.logo_url || "/placeholder.svg"} alt="Logo" className="h-12 mx-auto mb-8" />}

          <div className="text-center space-y-8">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${tier.bg}`}>
              <Sparkles className={`h-5 w-5 ${tier.color}`} />
              <span className={`font-medium ${tier.color}`}>{tier.title}</span>
            </div>

            <div>
              <p className="text-6xl font-bold" style={{ color: brandColor }}>
                {finalScore}
              </p>
              <p className="text-gray-500 mt-2">out of 100</p>
            </div>

            <p className="text-xl text-gray-700 max-w-md mx-auto">{tier.message}</p>

            <div className="bg-gray-50 rounded-xl p-6 text-left">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Score Delivered</span>
              </div>
              <p className="text-gray-600">Your AI Readiness Score has been sent to your inbox.</p>
            </div>

            <Button
              size="lg"
              className="text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: brandColor }}
              onClick={() => router.push(quiz.cta_url || "/book-audit")}
            >
              {quiz.cta_text || "Book Your AI Readiness Audit"}
            </Button>
          </div>

          <p className="text-center text-gray-400 text-sm mt-16">Powered by AI Readiness Audit System</p>
        </div>
      </div>
    )
  }

  // Hero screen
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          {quiz.logo_url && <img src={quiz.logo_url || "/placeholder.svg"} alt="Logo" className="h-12 mx-auto mb-12" />}

          <div className="text-center space-y-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              {quiz.title || "Discover Your AI Readiness Score in Under 3 Minutes"}
            </h1>

            <p className="text-xl text-gray-600 max-w-lg mx-auto">
              {quiz.description ||
                "Find out how ready your business is to automate, save time, and grow before spending a dollar on tools."}
            </p>

            <Button
              size="lg"
              className="text-white px-10 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: brandColor }}
              onClick={startQuiz}
            >
              Start Quiz
            </Button>
          </div>

          <p className="text-center text-gray-400 text-sm mt-16">Powered by AI Readiness Audit System</p>
        </div>
      </div>
    )
  }

  // Contact info step
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-xl mx-auto px-4 py-8">
          {quiz.logo_url && <img src={quiz.logo_url || "/placeholder.svg"} alt="Logo" className="h-10 mx-auto mb-8" />}

          <div className="mb-6">
            <Progress value={progress} className="h-2" style={{ "--progress-color": brandColor } as any} />
            <p className="text-sm text-gray-500 mt-2 text-center">Step 1 of {totalSteps - 1}</p>
          </div>

          <Card className="border-gray-200 shadow-lg rounded-2xl">
            <CardContent className="p-5 sm:p-8 space-y-5 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Let&apos;s get started</h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="firstName" className="text-gray-700">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={contactInfo.firstName}
                    onChange={(e) => setContactInfo((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="John"
                    className="mt-1 rounded-lg border-gray-300"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="john@company.com"
                    className="mt-1 rounded-lg border-gray-300"
                  />
                </div>

                <div>
                  <Label htmlFor="companyName" className="text-gray-700">
                    Company Name
                  </Label>
                  <Input
                    id="companyName"
                    value={contactInfo.companyName}
                    onChange={(e) => setContactInfo((prev) => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Acme Inc."
                    className="mt-1 rounded-lg border-gray-300"
                  />
                </div>
              </div>

              <Button
                className="w-full text-white py-6 text-lg rounded-xl"
                style={{ backgroundColor: brandColor }}
                onClick={handleContactSubmit}
                disabled={!contactInfo.firstName || !contactInfo.email || !contactInfo.companyName}
              >
                Continue <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-gray-400 text-sm mt-8">Powered by AI Readiness Audit System</p>
        </div>
      </div>
    )
  }

  // Question steps
  const questionIndex = currentStep - 2
  const question = quiz.questions[questionIndex]
  const isLastQuestion = questionIndex === quiz.questions.length - 1
  const hasAnswer = answers[question?.id] !== undefined

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-4 py-8">
        {quiz.logo_url && <img src={quiz.logo_url || "/placeholder.svg"} alt="Logo" className="h-10 mx-auto mb-8" />}

        <div className="mb-6">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-gray-500 mt-2 text-center">
            Question {questionIndex + 1} of {quiz.questions.length}
          </p>
        </div>

        <Card className="border-gray-200 shadow-lg rounded-2xl">
          <CardContent className="p-5 sm:p-8 space-y-5 sm:space-y-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{question?.text}</h2>

            <div className="space-y-3">
              {question?.options?.map((option, idx) => {
                const isSelected = answers[question.id] === option.value
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(question.id, option.value)}
                    className={`w-full min-h-[56px] p-4 text-left rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    style={isSelected ? { borderColor: brandColor, backgroundColor: `${brandColor}10` } : {}}
                  >
                    <span className={`font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                      {option.text}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={prevQuestion} className="flex-1 py-6 rounded-xl bg-transparent">
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button
                className="flex-1 text-white py-6 rounded-xl"
                style={{ backgroundColor: brandColor }}
                onClick={nextQuestion}
                disabled={!hasAnswer || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isLastQuestion ? (
                  "See My Results"
                ) : (
                  <>
                    Next <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-gray-400 text-sm mt-8">Powered by AI Readiness Audit System</p>
      </div>
    </div>
  )
}
