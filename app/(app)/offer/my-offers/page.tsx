"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { FileText, Plus, Loader2, Trash2, Pencil } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import { cn } from "@/lib/utils"
// Shared pricing helpers — replaces the inline getPricingModelBadge that
// previously lived in this file (Phase 4F consolidation).
import { getPricingModelBadge } from "@/lib/pricing"

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
  const router = useRouter()
  
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Bulk selection state
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([])
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  
  // Outreach status per offer
  const [outreachByOffer, setOutreachByOffer] = useState<Record<string, { total: number, sent: number }>>({})
  const [activatingOffer, setActivatingOffer] = useState<string | null>(null)

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
      
      // Fetch outreach status for all offers
      const offerIds = data.map(o => o.id)
      if (offerIds.length > 0) {
        const { data: outreachData } = await supabase
          .from("outreach_messages")
          .select("offer_id, status")
          .in("offer_id", offerIds)
        
        // Build a map of offer_id -> { total, sent }
        const outreachMap = outreachData?.reduce((acc, msg) => {
          if (!acc[msg.offer_id]) acc[msg.offer_id] = { total: 0, sent: 0 }
          acc[msg.offer_id].total++
          if (msg.status === "sent") acc[msg.offer_id].sent++
          return acc
        }, {} as Record<string, { total: number, sent: number }>) || {}
        
        setOutreachByOffer(outreachMap)
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  const handleDeleteClick = (offer: Offer) => {
    setOfferToDelete(offer)
    setDeleteModalOpen(true)
  }

  const handleCreateOutreach = async (offerId: string) => {
    if (!userId) return
    setActivatingOffer(offerId)
    
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
    setActivatingOffer(null)
    router.push("/outreach")
  }

  // Bulk selection handlers
  const toggleSelect = (offerId: string) => {
    setSelectedOfferIds(prev => 
      prev.includes(offerId) 
        ? prev.filter(id => id !== offerId)
        : [...prev, offerId]
    )
  }

  const selectAll = () => {
    setSelectedOfferIds(offers.map(o => o.id))
  }

  const clearSelection = () => {
    setSelectedOfferIds([])
  }

  const selectedIncludesActive = selectedOfferIds.some(id => 
    offers.find(o => o.id === id)?.is_active
  )

  const handleBulkDelete = async () => {
    if (!userId || selectedOfferIds.length === 0) return
    setBulkDeleting(true)

    await supabase
      .from("offers")
      .delete()
      .in("id", selectedOfferIds)

    if (selectedIncludesActive) {
      await supabase
        .from("profiles")
        .update({ offer_id: null })
        .eq("id", userId)
      await refreshState()
    }

    setSelectedOfferIds([])
    setShowBulkDeleteModal(false)
    setBulkDeleting(false)
    await fetchOffers()
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

  // `getPricingModelBadge` is now imported from @/lib/pricing. The shared
  // helper returns the same { color, label } shape so existing call sites
  // below don't need any changes.

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
            <Link href="/offer/builder?mode=new">
              <Plus className="h-4 w-4 mr-2" />
              Build new offer
            </Link>
          </Button>
        </div>

        {/* Sticky Action Bar for Bulk Selection */}
        {selectedOfferIds.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center justify-between bg-[#080B0F] border-b border-white/10 px-4 py-3 mb-4 -mx-6 rounded-t-xl">
            <span className="text-sm text-white/60">
              {selectedOfferIds.length} selected
            </span>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBulkDeleteModal(true)}
                className="text-red-400 hover:text-red-400 hover:bg-red-400/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete selected
              </Button>
            </div>
          </div>
        )}

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
            const outreach = outreachByOffer[offer.id]
            const hasOutreach = outreach && outreach.total > 0
            const sentCount = outreach?.sent || 0
            
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
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedOfferIds.includes(offer.id)}
                        onCheckedChange={() => toggleSelect(offer.id)}
                        className="border-white/30 data-[state=checked]:bg-[#00AAFF] data-[state=checked]:border-[#00AAFF]"
                      />
                    </div>
                    
                    <div className="flex items-start justify-between gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        {/* Niche as Title, Service Name as Subtitle */}
                        <div className="flex items-center gap-3 mb-1">
                          <div className="min-w-0">
                            <p className="text-white font-bold text-base truncate">{offer.niche}</p>
                            <p className="text-white/40 text-sm truncate">{offer.service_name}</p>
                          </div>
                        {offer.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#00AAFF]/10 text-[#00AAFF] border border-[#00AAFF]/30 shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn("text-xs px-2 py-1 rounded-full border", pricingBadge.color)}>
                          {pricingBadge.label}
                        </span>
                        <span className={cn("text-xs px-2 py-1 rounded-full border", confidenceBadge.color)}>
                          {confidenceBadge.label}
                        </span>
                      </div>
                      
                      {/* Price Point */}
                      <p className="text-white font-medium mb-2">{offer.price_point}</p>
                      
                      {/* Outreach Status */}
                      {hasOutreach ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">
                            {sentCount} of {outreach.total} messages sent
                          </span>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            sentCount >= 20 ? "bg-green-500" : 
                            sentCount > 0 ? "bg-[#00AAFF]" : 
                            "bg-white/20"
                          )} />
                        </div>
                      ) : (
                        <p className="text-xs text-white/30">No outreach generated yet</p>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-xs text-white/40">
                        {formatDate(offer.created_at)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {/* Outreach action button */}
                        {hasOutreach ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push("/outreach")}
                            className="text-[#00AAFF] hover:text-[#00AAFF] hover:bg-[#00AAFF]/10"
                          >
                            View outreach
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateOutreach(offer.id)}
                            disabled={activatingOffer === offer.id}
                            className="text-white/70 hover:text-white hover:bg-white/10"
                          >
                            {activatingOffer === offer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : null}
                            Create outreach
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="text-white/70 hover:text-white hover:bg-white/10"
                        >
                          <Link href={`/offer/builder?edit=${offer.id}`}>
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

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="bg-[#0A0D12] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Delete {selectedOfferIds.length} Offers</DialogTitle>
            <DialogDescription className="text-white/60 space-y-3">
              <p>
                Delete {selectedOfferIds.length} offer{selectedOfferIds.length !== 1 ? "s" : ""}? This cannot be undone.
              </p>
              {selectedIncludesActive && (
                <p className="text-amber-400">
                  Warning: your active offer is included. Your outreach will lose its offer context until you set a new active offer.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteModal(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {bulkDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete all selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
