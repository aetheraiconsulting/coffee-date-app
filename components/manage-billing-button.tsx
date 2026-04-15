"use client"

export function ManageBillingButton() {
  const handleManage = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }
  return (
    <button
      onClick={handleManage}
      className="text-sm border border-white/15 text-white/60 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg transition-colors"
    >
      Manage billing →
    </button>
  )
}
