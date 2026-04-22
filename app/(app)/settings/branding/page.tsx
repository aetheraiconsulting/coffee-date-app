"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Trash2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export default function BrandingPage() {
  const { toast } = useToast()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [brandColour, setBrandColour] = useState("#00AAFF")
  const [calendarLink, setCalendarLink] = useState("")

  useEffect(() => {
    loadBranding()
  }, [])

  const loadBranding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data, error } = await supabase
        .from("user_branding")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setCompanyName(data.company_name || "")
        setLogoUrl(data.logo_url || "")
        setBrandColour(data.brand_colour || "#00AAFF")
        setCalendarLink(data.calendar_link || "")
      }
    } catch (error) {
      console.error("Error loading branding:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 2MB", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`

      const { error } = await supabase.storage
        .from("user-logos")
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from("user-logos")
        .getPublicUrl(fileName)

      setLogoUrl(urlData.publicUrl)
      toast({ title: "Logo uploaded", description: "Your logo has been uploaded successfully" })
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = () => {
    setLogoUrl("")
  }

  const handleSave = async () => {
    if (!userId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("user_branding")
        .upsert({
          user_id: userId,
          company_name: companyName,
          logo_url: logoUrl,
          brand_colour: brandColour,
          calendar_link: calendarLink,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" })

      if (error) throw error

      toast({ title: "Branding saved", description: "Your branding settings have been updated" })
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white font-[family-name:var(--font-syne)]">Your Branding</h1>
        <p className="text-white/60 mt-1">Used on client-facing pages and audit reports.</p>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6 space-y-8">
          {/* Section 1: Company Name */}
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Company name</Label>
            <Input
              placeholder="e.g. Apex AI Solutions"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
            <p className="text-white/40 text-xs">Shown on public audit pages and PDF reports</p>
          </div>

          {/* Section 2: Logo Upload */}
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Company logo</Label>
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-[#00AAFF]/50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white/40 animate-spin mx-auto" />
                ) : (
                  <>
                    <p className="text-white/40 text-sm">Click to upload logo</p>
                    <p className="text-white/20 text-xs mt-1">PNG, JPG or SVG — max 2MB</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          {/* Section 3: Brand Color. Variable + DB column names keep the
              British `colour` spelling because the `user_branding.brand_colour`
              column is the source of truth and renaming it is out of scope. */}
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Brand color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColour}
                onChange={(e) => setBrandColour(e.target.value)}
                className="w-12 h-12 rounded cursor-pointer border border-white/20 bg-transparent"
              />
              <Input
                value={brandColour}
                onChange={(e) => setBrandColour(e.target.value)}
                placeholder="#00AAFF"
                className="flex-1 bg-white/5 border-white/10 text-white font-mono"
              />
            </div>
            <p className="text-white/40 text-xs">Used as accent color on client-facing pages</p>
          </div>

          {/* Section 4: Calendar Link */}
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Calendar booking link</Label>
            <Input
              placeholder="https://calendly.com/yourname"
              value={calendarLink}
              onChange={(e) => setCalendarLink(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
            <p className="text-white/40 text-xs">Shown on audit thank you page so prospects can book directly</p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save branding"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
