"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Play, Briefcase, Search, Monitor } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface StartDemoButtonsProps {
  androidId: string
  androidName: string
}

interface Niche {
  id: string
  niche_name: string
  industry: {
    name: string
  }
}

export default function StartDemoButtons({ androidId, androidName }: StartDemoButtonsProps) {
  const [showNicheModal, setShowNicheModal] = useState(false)
  const [niches, setNiches] = useState<Niche[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (showNicheModal) {
      fetchNiches()
    }
  }, [showNicheModal])

  useEffect(() => {
    if (!showNicheModal) {
      setSearchQuery("")
    }
  }, [showNicheModal])

  const fetchNiches = async () => {
    try {
      const response = await fetch("/api/niches")
      if (response.ok) {
        const data = await response.json()
        setNiches(data)
      }
    } catch (error) {
      console.error("Error fetching niches:", error)
    }
  }

  const handleStartTest = async () => {
    try {
      await fetch("/api/demo-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          androidId,
          type: "test",
        }),
      })
      router.push(`/demo/${androidId}?type=test`)
    } catch (error) {
      console.error("Error logging test session:", error)
      router.push(`/demo/${androidId}?type=test`)
    }
  }

  const handleStartClientDemo = () => {
    setShowNicheModal(true)
  }

  const handleNicheSelect = async (nicheId: string | null, nicheName: string) => {
    setIsLoading(true)
    try {
      await fetch("/api/demo-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          androidId,
          type: "client",
          nicheId,
          nicheName: nicheId ? undefined : nicheName,
        }),
      })

      setShowNicheModal(false)
      toast({
        title: "Client Demo Started",
        description: nicheId ? `Demo for ${nicheName}` : "Demo for Other niche",
      })
      router.push(`/demo/${androidId}?type=client&niche=${encodeURIComponent(nicheName)}`)
    } catch (error) {
      console.error("Error starting client demo:", error)
      toast({
        title: "Error",
        description: "Failed to log demo session",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredNiches = niches.filter(
    (niche) =>
      niche.niche_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      niche.industry.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <>
      <div className="flex gap-2 mt-4">
        <Button
          onClick={handleStartTest}
          variant="outline"
          className="flex-1 border-white/30 text-white bg-transparent hover:bg-white hover:text-black hover:border-[#08A8FF] transition-all"
        >
          <Play className="h-[18px] w-[18px] mr-2" />
          Start Test
        </Button>
        <Button
          onClick={handleStartClientDemo}
          className="flex-1 bg-[#00A8FF] text-white hover:bg-[#0099EE] transition-all h-9 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium"
        >
          <Briefcase className="h-[18px] w-[18px] mr-2 text-white" />
          Start Client Demo
        </Button>
        <Button
          onClick={() => router.push(`/demo/${androidId}?present=true`)}
          variant="outline"
          className="border-white/20 text-white/60 bg-transparent hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
          title="Present mode for screen sharing"
        >
          <Monitor className="h-[18px] w-[18px]" />
        </Button>
      </div>

      {/* Niche Selection Modal for Client Demos */}
      <Dialog open={showNicheModal} onOpenChange={setShowNicheModal}>
        <DialogContent className="sm:max-w-[500px] bg-black border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Which niche is this demo for?</DialogTitle>
            <DialogDescription className="text-white/60">
              Select the niche to track this client demo and update the pipeline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search niches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <ScrollArea className="h-[300px] rounded-lg border border-white/10 bg-white/5">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => handleNicheSelect(null, "Other")}
                  disabled={isLoading}
                  className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors border border-white/20 bg-white/5"
                >
                  <div className="font-medium text-white">Other</div>
                  <div className="text-sm text-white/60">Not tracking a specific niche</div>
                </button>

                {filteredNiches.length === 0 ? (
                  <div className="p-4 text-center text-white/60">No niches found</div>
                ) : (
                  filteredNiches.map((niche) => (
                    <button
                      key={niche.id}
                      onClick={() => handleNicheSelect(niche.id, niche.niche_name)}
                      disabled={isLoading}
                      className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="font-medium text-white">{niche.niche_name}</div>
                      <div className="text-sm text-white/60">{niche.industry.name}</div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
