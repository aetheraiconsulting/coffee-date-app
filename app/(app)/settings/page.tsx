"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Upload, Loader2, Check, X, Globe } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Image from "next/image"
import { SubscriptionCard } from "@/components/subscription-card"

const MAIN_DOMAIN = "aetherrevive.com"

export default function SettingsPage() {
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [subdomain, setSubdomain] = useState("")
  const [subdomainError, setSubdomainError] = useState("")
  const [checkingSubdomain, setCheckingSubdomain] = useState(false)
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.from("profiles").select("*, subscription_status, trial_ends_at, stripe_customer_id, subscription_ends_at").eq("id", user.id).single()

      if (error) throw error

      setProfile(data)
      setFullName(data?.full_name || "")
      setEmail(data?.email || user.email || "")
      setSubdomain(data?.subdomain || "")
    } catch (error) {
      console.error("Error loading profile:", error)
    }
  }

  const validateSubdomain = (value: string): string => {
    if (!value) return ""
    if (value.length < 3) return "Subdomain must be at least 3 characters"
    if (value.length > 30) return "Subdomain must be 30 characters or less"
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
      return "Only lowercase letters, numbers, and hyphens allowed. Cannot start or end with hyphen."
    }
    const reserved = ["www", "api", "app", "admin", "mail", "smtp", "ftp", "support", "help"]
    if (reserved.includes(value)) return "This subdomain is reserved"
    return ""
  }

  const checkSubdomainAvailability = async (value: string) => {
    if (!value || validateSubdomain(value)) {
      setSubdomainAvailable(null)
      return
    }

    setCheckingSubdomain(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("subdomain", value)
        .neq("id", user?.id || "")
        .maybeSingle()

      if (error) throw error
      setSubdomainAvailable(!data)
      if (data) {
        setSubdomainError("This subdomain is already taken")
      }
    } catch (error) {
      console.error("Error checking subdomain:", error)
    } finally {
      setCheckingSubdomain(false)
    }
  }

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setSubdomain(value)
    const error = validateSubdomain(value)
    setSubdomainError(error)
    setSubdomainAvailable(null)

    if (!error && value) {
      const timeoutId = setTimeout(() => checkSubdomainAvailability(value), 500)
      return () => clearTimeout(timeoutId)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split(".").pop()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      const fileName = `${user.id}/profile.${fileExt}`

      const { error: uploadError } = await supabase.storage.from("profiles").upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from("profiles").getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_image_url: data.publicUrl })
        .eq("id", user.id)

      if (updateError) throw updateError

      toast({
        title: "Image uploaded",
        description: "Your profile image has been updated successfully",
      })

      loadProfile()
      window.dispatchEvent(
        new CustomEvent("profile-image-updated", {
          detail: { imageUrl: data.publicUrl },
        }),
      )
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (subdomain && (subdomainError || subdomainAvailable === false)) {
      toast({
        title: "Invalid subdomain",
        description: subdomainError || "This subdomain is already taken",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No user found")

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          email,
          subdomain: subdomain || null,
        })
        .eq("id", user.id)

      if (error) throw error

      toast({
        title: "Profile updated",
        description: subdomain
          ? `Your profile has been saved. Your subdomain is ${subdomain}.${MAIN_DOMAIN}`
          : "Your profile has been saved successfully",
      })

      loadProfile()
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-white/60">Manage your account and profile settings</p>
      </div>

      {/* Subscription Card */}
      <SubscriptionCard profile={profile} />

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Profile Picture / Company Logo</Label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full bg-white/5 border-2 border-white/10 overflow-hidden flex items-center justify-center">
                {profile?.profile_image_url ? (
                  <Image
                    src={profile.profile_image_url || "/placeholder.svg"}
                    alt="Profile"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="h-8 w-8 text-white/40" />
                )}
              </div>
              <div>
                <input
                  type="file"
                  id="profile-image"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                <Button
                  onClick={() => document.getElementById("profile-image")?.click()}
                  disabled={uploading}
                  className="bg-[#00A8FF] hover:bg-[#0090DD] text-white"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </>
                  )}
                </Button>
                <p className="text-xs text-white/40 mt-1">PNG, JPG up to 2MB</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Name
            </Label>
            <Input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <Button onClick={handleSaveProfile} disabled={loading} className="bg-[#00A8FF] hover:bg-[#0090DD] text-white">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Custom Subdomain
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-white/60 text-sm">
            Choose a unique subdomain for your agency. All your shared links (quizzes, audits) will use this subdomain,
            making them look branded to your agency.
          </p>

          <div className="space-y-2">
            <Label htmlFor="subdomain" className="text-white">
              Your Subdomain
            </Label>
            <div className="flex items-center gap-0">
              <div className="relative flex-1">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={handleSubdomainChange}
                  onBlur={() => subdomain && checkSubdomainAvailability(subdomain)}
                  placeholder="yourcompany"
                  className={`bg-white/5 border-white/10 text-white rounded-r-none pr-10 ${
                    subdomainError ? "border-red-500" : subdomainAvailable === true ? "border-green-500" : ""
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingSubdomain && <Loader2 className="h-4 w-4 text-white/40 animate-spin" />}
                  {!checkingSubdomain && subdomainAvailable === true && !subdomainError && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!checkingSubdomain && (subdomainAvailable === false || subdomainError) && subdomain && (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
              <div className="bg-white/10 border border-l-0 border-white/10 px-3 py-2 rounded-r-md text-white/50 text-sm whitespace-nowrap">
                .{MAIN_DOMAIN}
              </div>
            </div>

            {subdomainError && <p className="text-red-400 text-xs">{subdomainError}</p>}
            {!subdomainError && subdomainAvailable === true && subdomain && (
              <p className="text-green-400 text-xs">This subdomain is available!</p>
            )}
            {!subdomainError && !subdomain && (
              <p className="text-white/40 text-xs">Lowercase letters, numbers, and hyphens only. 3-30 characters.</p>
            )}
          </div>

          {subdomain && !subdomainError && subdomainAvailable !== false && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="text-white/60 text-xs mb-2">Your links will look like:</p>
              <div className="space-y-1">
                <p className="text-[#00A8FF] text-sm font-mono">
                  https://{subdomain}.{MAIN_DOMAIN}/quiz/...
                </p>
                <p className="text-[#00A8FF] text-sm font-mono">
                  https://{subdomain}.{MAIN_DOMAIN}/audit/...
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSaveProfile}
            disabled={loading || (subdomain !== "" && (!!subdomainError || subdomainAvailable === false))}
            className="bg-[#00A8FF] hover:bg-[#0090DD] text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Subdomain"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
