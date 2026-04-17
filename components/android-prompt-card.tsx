"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export function AndroidPromptCard({ userId, nicheId }: { userId: string; nicheId: string }) {
  const supabase = createClient()
  const [android, setAndroid] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAndroid = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("androids")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      setAndroid(data)
      setLoading(false)
    }
    fetchAndroid()
  }, [userId, nicheId, supabase])

  const handleCopy = () => {
    if (!android?.prompt) return
    navigator.clipboard.writeText(android.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="border border-white/10 rounded-xl p-5 mb-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-2"></div>
        <div className="h-6 bg-white/10 rounded w-2/3"></div>
      </div>
    )
  }

  if (!android) {
    return (
      <div className="border border-white/10 rounded-xl p-5 mb-4">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
          Client Android Prompt
        </p>
        <p className="text-white/30 text-sm mb-3">
          No Android built for this niche yet. Build one to use in your GHL workflow.
        </p>
        <Link href="/prompt-generator" className="text-sm text-[#00AAFF] hover:underline">
          Build Android →
        </Link>
      </div>
    )
  }

  return (
    <div className="border border-white/10 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-0.5">
            Client Android Prompt
          </p>
          <p className="text-white text-sm font-semibold">
            {android.name} — {android.company_name}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${
            copied
              ? "bg-green-500/20 text-green-400"
              : "bg-[#00AAFF]/15 text-[#00AAFF] hover:bg-[#00AAFF]/25"
          }`}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>
      <p className="text-white/25 text-xs">
        Paste this prompt into your GHL dead lead revival workflow as the AI conversation handler.
      </p>
    </div>
  )
}
