"use client"

import { User, LogOut, Settings2, Menu } from 'lucide-react'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { NotificationBell } from '@/components/notification-bell'

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [profileImage, setProfileImage] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
    
    const handleProfileUpdate = (event: any) => {
      if (event.detail?.imageUrl) {
        setProfileImage(event.detail.imageUrl)
      }
    }
    
    window.addEventListener('profile-image-updated', handleProfileUpdate)
    
    return () => {
      window.removeEventListener('profile-image-updated', handleProfileUpdate)
    }
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setProfileImage(data?.profile_image_url || null)
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    })
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 h-[73px]">
        {/* Hamburger is rendered only below `lg`; on desktop this slot stays
            empty but the flex container still pushes actions to the right. */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0 overflow-hidden">
                {profileImage ? (
                  <Image
                    src={profileImage || "/placeholder.svg"}
                    alt="Profile"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-black border-white/10">
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="cursor-pointer text-white hover:bg-white/10"
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="cursor-pointer text-white hover:bg-white/10"
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400 hover:bg-white/10">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
