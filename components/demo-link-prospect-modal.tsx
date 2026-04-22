"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Search, UserPlus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ProspectRow {
  id: string
  name: string | null
  email: string | null
  business: string | null
}

interface DemoLinkProspectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  androidId: string
  onLinked?: (prospectId: string) => void
}

/**
 * Modal used during a demo session to attribute the demo to a specific
 * prospect. Supports two flows:
 *   1. Pick an existing prospect (searchable by name / email / business).
 *   2. Add a new prospect inline (email + optional name / business).
 *
 * On submit we do three things:
 *   a. Ensure the prospect exists (insert if new).
 *   b. Insert a `demo_logs` row with type="client" linking android + prospect.
 *   c. Emit a `prospect_demo_viewed` notification.
 * All three use the authenticated Supabase client — RLS policies on each
 * table already restrict writes to rows owned by auth.uid().
 */
export function DemoLinkProspectModal({
  open,
  onOpenChange,
  userId,
  androidId,
  onLinked,
}: DemoLinkProspectModalProps) {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [prospects, setProspects] = useState<ProspectRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [mode, setMode] = useState<"pick" | "new">("pick")

  // New-prospect form state.
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newBusiness, setNewBusiness] = useState("")

  useEffect(() => {
    if (!open) return
    void loadProspects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function loadProspects() {
    setLoading(true)
    const { data } = await supabase
      .from("prospects")
      .select("id, name, email, business")
      .eq("user_id", userId)
      .order("last_activity_at", { ascending: false })
      .limit(50)
    setProspects(data ?? [])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return prospects
    return prospects.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.business || "").toLowerCase().includes(q),
    )
  }, [prospects, search])

  async function linkToProspect(prospect: ProspectRow) {
    setSubmitting(true)
    try {
      const { error: logError } = await supabase.from("demo_logs").insert({
        user_id: userId,
        android_id: androidId,
        prospect_id: prospect.id,
        // `type` has a CHECK constraint of ('test', 'client') — linking to a
        // real prospect is by definition a client demo.
        type: "client",
      })
      if (logError) throw logError

      const label = prospect.name || prospect.business || prospect.email || "a prospect"
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "prospect_demo_viewed",
        title: "Demo linked",
        body: `Demo session attributed to ${label}.`,
        action_href: `/clients`,
        related_id: prospect.id,
        read: false,
      })

      // Bump the prospect's last_activity so they surface at the top of the
      // list next time the modal opens.
      await supabase
        .from("prospects")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", prospect.id)

      toast({
        title: "Linked to prospect",
        description: `This demo is now attributed to ${label}.`,
      })
      onLinked?.(prospect.id)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: "Could not link prospect",
        description: (err as Error).message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function createAndLink() {
    const email = newEmail.trim().toLowerCase()
    if (!email) {
      toast({
        title: "Email required",
        description: "Enter the prospect's email so we can de-duplicate later.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      // Upsert-style: if a prospect with this email already exists for this
      // user, reuse it instead of inserting a duplicate.
      const { data: existing } = await supabase
        .from("prospects")
        .select("id, name, email, business")
        .eq("user_id", userId)
        .eq("email", email)
        .maybeSingle()

      let prospect: ProspectRow | null = existing
      if (!prospect) {
        const nowIso = new Date().toISOString()
        const { data: inserted, error: insertError } = await supabase
          .from("prospects")
          .insert({
            user_id: userId,
            email,
            name: newName.trim() || null,
            business: newBusiness.trim() || null,
            source: "demo",
            metadata: { sources: ["demo"] },
            first_contact_at: nowIso,
            last_activity_at: nowIso,
          })
          .select("id, name, email, business")
          .single()
        if (insertError) throw insertError
        prospect = inserted
      }

      if (prospect) await linkToProspect(prospect)
    } catch (err) {
      toast({
        title: "Could not create prospect",
        description: (err as Error).message,
        variant: "destructive",
      })
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:max-w-[480px] bg-[#0B0F14] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Link demo to prospect</DialogTitle>
        </DialogHeader>

        {/* Mode toggle — 2 cleanly separated tabs rather than a multi-step wizard. */}
        <div className="flex gap-2 mb-2 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setMode("pick")}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              mode === "pick" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            Existing prospect
          </button>
          <button
            onClick={() => setMode("new")}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              mode === "new" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            Add new
          </button>
        </div>

        {mode === "pick" ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search by name, email, or business…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <div className="max-h-[320px] overflow-y-auto -mx-6 px-6 mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading prospects…
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-sm text-white/50">
                  {prospects.length === 0
                    ? "No prospects yet. Switch to \u2018Add new\u2019 to create one."
                    : "No matches for your search."}
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => linkToProspect(p)}
                        className="w-full text-left py-3 min-h-[52px] hover:bg-white/5 px-2 rounded-md transition-colors disabled:opacity-50"
                      >
                        <p className="text-sm font-medium text-white truncate">
                          {p.name || p.email || "Unnamed prospect"}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {[p.business, p.email].filter(Boolean).join(" \u2022 ") || "\u00A0"}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Email *</label>
              <Input
                type="email"
                placeholder="prospect@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Name</label>
              <Input
                placeholder="Jane Smith"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Business</label>
              <Input
                placeholder="Acme Co."
                value={newBusiness}
                onChange={(e) => setNewBusiness(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <Button
              onClick={createAndLink}
              disabled={submitting || !newEmail.trim()}
              className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Add and link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
