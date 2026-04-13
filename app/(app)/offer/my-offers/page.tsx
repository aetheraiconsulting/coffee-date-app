"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileText, Plus, Loader2, Trash2, Pencil, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import { cn } from "@/lib/utils"

interface Offer {
  id: string
  user_id: string
  service_name: string
  niche: string
  outcome_statement: string
  price_point: string
  pricing_model: string
  guarantee: string
  confidence_score: "strong" | "needs_work" | "weak"
  confidence_reason: string
  is_active: boolean
  created_at: string
}

export default function MyOffersPage() {
  const supabase = createClient()
  const { refreshState } = useUserState()
  
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [settingActive, setSettingActive] = useState<string | null>(null)

  const fetchOffers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    
    setUserId(user.id)
    
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    
    if (!error && data) {
      setOffers(data)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  const handleSetActive = async (offerId: string) => {
    if (!userId) return
    setSettingActive(offerId)
    
    // Deactivate all offers
    await supabase
      .from("offers")
      .update({ is_active: false })
      .eq("user_id", userId)

    // Activate selected offer
    await supabase
      .from("offers")
      .update({ is_active: true })
      .eq("id", offerId)

    // Update profiles.offer_id
    await supabase
      .from("profiles")
      .update({ offer_id: offerId })
      .eq("id", userId)

    await refreshState()
    await fetchOffers()
    setSettingActive(null)
  }

  const handleDeleteClick = (offer: Offer) => {
    setOfferToDelete(offer)
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!offerToDelete || !userId) return
    setDeleting(true)

    await supabase
      .from("offers")
      .delete()
      .eq("id", offerToDelete.id)

    if (offerToDelete.is_active) {
      await supabase
        .from("profiles")
        .update({ offer_id: null })
        .eq("id", userId)
      await refreshState()
    }

    await fetchOffers()
    setDeleting(false)
    setDeleteModalOpen(false)
    setOfferToDelete(null)
  }

  const getPricingModelBadge = (model: string) => {
    const isPerformance = ["50_profit_share", "custom_profit_share", "pay_per_lead", "pay_per_conversation"].includes(model)
    return {
      color: isPerformance 
        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
        : "bg-amber-400/10 text-amber-400 border-amber-400/30",
      label: model?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Unknown"
    }
  }

  const getConfidenceBadge = (score: "strong" | "needs_work" | "weak") => {
    switch (score) {
      case "strong":
        return { color: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30", label: "Strong" }
      case "needs_work":
        return { color: "bg-amber-400/10 text-amber-400 border-amber-400/30", label: "Needs Work" }
      case "weak":
        return { color: "bg-red-400/10 text-red-400 border-red-400/30", label: "Weak" }
      default:
        return { color: "bg-white/10 text-white/60 border-white/20", label: score }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B0F] p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#00AAFF] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080B0F] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-[#00AAFF]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#00AAFF]">
                Offer Management
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">My Offers</h1>
            <p className="text-white/60">
              Your saved offers. One active at a time.
            </p>
          </div>
          <Button
            asChild
            className="bg-[#00AAFF] hover:bg-[#0099EE] text-white shadow-lg shadow-[#00AAFF]/30"
          >
            <Link href="/offer/builder">
              <Plus className="h-4 w-4 mr-2" />
              Build new offer
            </Link>
          </Button>
        </div>

        {/* Empty State */}
        {offers.length === 0 && (
          <Card className="bg-[rgba(255,255,255,0.03)] border-[0.5px] border-[rgba(255,255,255,0.08)] rounded-xl">
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No offers yet</h2>
              <p className="text-white/60 mb-6">
                Build your first offer to get started.
              </p>
              <Button
                asChild
                className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
              >
                <Link href="/offer/builder">
                  Build your offer
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Offers Grid */}
        <div className="grid gap-4 md:grid-cols-1">
          {offers.map((offer) => {
            const pricingBadge = getPricingModelBadge(offer.pricing_model)
            const confidenceBadge = getConfidenceBadge(offer.confidence_score)
            
            return (
              <Card
                key={offer.id}
                className={cn(
                  "rounded-xl transition-all",
                  offer.is_active
                    ? "bg-[rgba(0,170,255,0.04)] border-[0.5px] border-[#00AAFF]"
                    : "bg-[rgba(255,255,255,0.03)] border-[0.5px] border-[rgba(255,255,255,0.08)]"
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Service Name */}
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-white truncate">
                          {offer.service_name}
                        </h3>
                        {offer.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#00AAFF]/10 text-[#00AAFF] border border-[#00AAFF]/30 shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {/* Niche */}
                      <p className="text-sm text-white/50 mb-3">{offer.niche}</p>
                      
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={cn("text-xs px-2 py-1 rounded-full border", pricingBadge.color)}>
                          {pricingBadge.label}
                        </span>
                        <span className={cn("text-xs px-2 py-1 rounded-full border", confidenceBadge.color)}>
                          {confidenceBadge.label}
                        </span>
                      </div>
                      
                      {/* Price Point */}
                      <p className="text-white font-medium">{offer.price_point}</p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-xs text-white/40">
                        {formatDate(offer.created_at)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {!offer.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetActive(offer.id)}
                            disabled={settingActive === offer.id}
                            className="text-[#00AAFF] hover:text-[#00AAFF] hover:bg-[#00AAFF]/10"
                          >
                            {settingActive === offer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Set as active
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <Link href="/offer/builder">
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Link>
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(offer)}
                          className="text-red-400 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="bg-[#0A0D12] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Offer</DialogTitle>
            <DialogDescription className="text-white/60">
              Are you sure you want to delete this offer? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
